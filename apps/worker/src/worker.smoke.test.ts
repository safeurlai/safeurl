/**
 * Worker image analysis test
 *
 * Tests that the worker can process image URLs and perform visual analysis.
 *
 * Prerequisites:
 * - Redis must be running
 * - Database must be accessible
 * - Docker must be available (for container tests)
 */

import {
  createDatabase,
  scanJobs,
  scanResults,
  users,
  wallets,
} from "@safeurl/db";
import { Queue, type Worker } from "bullmq";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { createWorker } from "./queue/processor";

const TEST_USER_ID = "test_worker_user";
const IMAGE_URL = "https://i.4cdn.org/cgl/1683919741567583.jpg";

// Create database instance for tests
const dbInstance = createDatabase({
  url: process.env.TURSO_CONNECTION_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
const db = dbInstance.db;

// Create queue connection for testing
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  connectTimeout: 5000,
  lazyConnect: true,
});

let scanQueue: Queue | null = null;
let worker: Worker | null = null;

beforeAll(async () => {
  // Verify OPENROUTER_API_KEY is set (required for image analysis)
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is required for tests",
    );
  }

  // Verify Redis connection
  await redisConnection.connect();
  const pong = await redisConnection.ping();
  if (pong !== "PONG") {
    throw new Error(`Redis ping failed: expected PONG, got ${pong}`);
  }

  // Create Queue
  scanQueue = new Queue("scan-jobs", {
    connection: redisConnection,
  });

  // Ensure test user exists with credits
  try {
    await db
      .insert(users)
      .values({ clerkUserId: TEST_USER_ID })
      .onConflictDoNothing();
  } catch {
    // User might already exist
  }

  const existingWallet = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, TEST_USER_ID))
    .limit(1);

  if (existingWallet.length === 0) {
    await db.insert(wallets).values({
      userId: TEST_USER_ID,
      creditBalance: 100,
    });
  } else {
    await db
      .update(wallets)
      .set({ creditBalance: 100 })
      .where(eq(wallets.userId, TEST_USER_ID));
  }

  // Start worker
  worker = createWorker();

  // Wait for worker to be ready
  let retries = 0;
  while (!worker.isRunning() && retries < 50) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    retries++;
  }

  if (!worker.isRunning()) {
    throw new Error("Worker failed to start");
  }
});

afterAll(async () => {
  if (worker) {
    await Promise.race([
      worker.close(),
      new Promise<void>((resolve) => setTimeout(resolve, 10000)),
    ]);
  }

  if (scanQueue) {
    await scanQueue.close();
  }

  if (redisConnection.status === "ready") {
    await redisConnection.quit();
  } else {
    redisConnection.disconnect();
  }
});

test("should analyze image URL and use screenshot-analysis tool", async () => {
  if (!worker || !scanQueue) {
    throw new Error("Worker or queue not initialized");
  }

  // Create a test job in the database
  const [job] = await db
    .insert(scanJobs)
    .values({
      userId: TEST_USER_ID,
      url: IMAGE_URL,
      state: "QUEUED",
      version: 1,
    })
    .returning();

  // Add job to queue
  await scanQueue.add("scan-url", {
    jobId: job.id,
    url: IMAGE_URL,
    userId: TEST_USER_ID,
  });

  // Wait for job to complete (up to 120 seconds for image analysis, same as fetcher test)
  let jobState = "QUEUED";
  const maxWaitTime = 120000; // 120 seconds, same as fetcher test
  const pollInterval = 500;
  const startTime = Date.now();

  while (
    jobState !== "COMPLETED" &&
    jobState !== "FAILED" &&
    Date.now() - startTime < maxWaitTime
  ) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const updatedJob = await db
      .select({ state: scanJobs.state })
      .from(scanJobs)
      .where(eq(scanJobs.id, job.id))
      .limit(1);

    if (updatedJob.length > 0) {
      jobState = updatedJob[0].state;
      if (jobState === "COMPLETED" || jobState === "FAILED") {
        break;
      }
    }
  }

  // Verify job completed successfully
  expect(jobState).toBe("COMPLETED");

  // Fetch the scan result
  const [result] = await db
    .select()
    .from(scanResults)
    .where(eq(scanResults.jobId, job.id))
    .limit(1);

  expect(result).toBeDefined();

  // Verify result structure - matching fetcher test exactly
  expect(result).toHaveProperty("riskScore");
  expect(result).toHaveProperty("categories");
  expect(result).toHaveProperty("reasoning");
  expect(result).toHaveProperty("indicators");
  expect(result).toHaveProperty("contentHash");
  expect(result).toHaveProperty("httpStatus");

  // Verify types - matching fetcher test exactly
  expect(typeof result.riskScore).toBe("number");
  expect(Array.isArray(result.categories)).toBe(true);
  expect(typeof result.reasoning).toBe("string");
  expect(Array.isArray(result.indicators)).toBe(true);

  // Note: confidenceScore is not stored in scanResults table (only in audit log)
  // The fetcher test checks for it in the JSON output, but it's part of the analysis result
  // We verify it exists in analysisMetadata if available
  if (result.analysisMetadata && typeof result.analysisMetadata === "object") {
    const metadata = result.analysisMetadata as Record<string, unknown>;
    if (metadata.confidenceScore !== undefined) {
      expect(typeof metadata.confidenceScore).toBe("number");
    }
  }

  // Verify visual analysis was performed - matching fetcher test exactly
  // For image URLs, we expect explicit mention of screenshot/visual analysis
  const reasoning = result.reasoning.toLowerCase();
  const hasVisualAnalysis =
    reasoning.includes("screenshot") ||
    reasoning.includes("visual") ||
    reasoning.includes("image") ||
    reasoning.includes("nsfw");

  // For image URLs, we should get visual analysis, not just metadata analysis
  // Check if reasoning mentions actual visual inspection vs just metadata
  const hasExplicitVisualAnalysis =
    reasoning.includes("screenshot") ||
    reasoning.includes("visual analysis") ||
    reasoning.includes("visually") ||
    (reasoning.includes("image") &&
      (reasoning.includes("content") ||
        reasoning.includes("appears") ||
        reasoning.includes("shows")));

  if (!hasExplicitVisualAnalysis) {
    console.warn(
      "Warning: Reasoning doesn't explicitly mention visual/screenshot analysis. " +
        "This might indicate screenshot capture failed or image wasn't attached to vision model. " +
        "Make sure the Docker image was rebuilt with Playwright browsers installed.",
    );
  }

  // Check if reasoning mentions screenshot capture failure
  if (reasoning.includes("screenshot capture failed")) {
    throw new Error(
      "Screenshot capture failed in Docker container. " +
        "Make sure Playwright browsers are installed in the fetcher Docker image. " +
        "Rebuild the image: docker build -t safeurl-fetcher:latest -f apps/fetcher/Dockerfile .",
    );
  }

  expect(hasVisualAnalysis).toBe(true);

  // Log the job result
  console.log("Job result:", {
    jobId: job.id,
    riskScore: result.riskScore,
    categories: result.categories,
    reasoning: result.reasoning.substring(0, 500),
    indicators: result.indicators,
    hasVisualAnalysis,
    hasExplicitVisualAnalysis,
  });
}, 120_000);
