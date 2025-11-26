/**
 * Worker functionality tests
 *
 * Tests that verify the worker can:
 * - Connect to Redis
 * - Process jobs from the queue
 * - Handle state transitions
 * - Store results
 *
 * Prerequisites:
 * - Redis must be running
 * - Database must be accessible
 * - Docker must be available (for container tests)
 */

import { test, expect, beforeAll, afterAll } from "bun:test";
import { createWorker } from "./queue/processor";
import { Queue } from "bullmq";
import Redis from "ioredis";
import {
  createDatabase,
  scanJobs,
  wallets,
  users,
  executeRawSQLString,
} from "@safeurl/db";
import { eq } from "drizzle-orm";
import type { Worker } from "bullmq";

// Create database instance for tests
const dbInstance = createDatabase({
  url: process.env.TURSO_CONNECTION_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
const db = dbInstance.db;
import { readFileSync } from "fs";
import { join } from "path";
import { sql } from "drizzle-orm";

// Create queue connection for testing
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

const scanQueue = new Queue("scan-jobs", {
  connection: redisConnection,
});

const TEST_USER_ID = "test_worker_user";

let worker: Worker | null = null;

/**
 * Run database migrations
 */
async function runMigrations() {
  const projectRoot = process.cwd().includes("apps/worker")
    ? join(process.cwd(), "../..")
    : process.cwd();
  const migrationPath = join(
    projectRoot,
    "packages/db/migrations/0000_flowery_jazinda.sql"
  );

  try {
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed) {
        try {
          await executeRawSQLString(dbInstance, trimmed);
        } catch (error: any) {
          const errorMsg = error?.message?.toLowerCase() || "";
          if (
            !errorMsg.includes("already exists") &&
            !errorMsg.includes("duplicate")
          ) {
            console.warn(`Migration warning: ${errorMsg.substring(0, 100)}`);
          }
        }
      }
    }
  } catch (error: any) {
    console.warn(`Could not run migrations: ${error?.message}`);
  }
}

/**
 * Ensure test user exists with credits
 */
async function setupTestUser() {
  try {
    await executeRawSQLString(
      dbInstance,
      `INSERT OR IGNORE INTO users (clerk_user_id) VALUES ('${TEST_USER_ID}')`
    );
  } catch (error) {
    // Try regular insert
    try {
      await db.insert(users).values({
        clerkUserId: TEST_USER_ID,
      });
    } catch {
      // User exists
    }
  }

  // Ensure wallet exists
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
}

beforeAll(async () => {
  // Run migrations
  await runMigrations();

  // Setup test user
  await setupTestUser();

  // Start worker
  try {
    worker = createWorker();
    console.log("[TEST] Worker started");

    // Give worker a moment to initialize and connect to Redis
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (error: any) {
    console.error(`[TEST] Failed to start worker: ${error?.message}`);
    throw error;
  }
});

afterAll(async () => {
  // Stop worker
  if (worker) {
    await worker.close();
    console.log("[TEST] Worker stopped");
  }

  // Close queue connection
  await scanQueue.close();
  await redisConnection.quit();
});

test("worker can connect to Redis and process queue", async () => {
  expect(worker).not.toBeNull();

  // Check that worker is active
  const isRunning = worker?.isRunning();
  expect(isRunning).toBe(true);

  console.log("[TEST] Worker is running and connected to Redis");
}, 5000);

test("worker processes jobs from queue", async () => {
  if (!worker) {
    throw new Error("Worker not initialized");
  }

  // Ensure worker is ready (wait for it to be running)
  let retries = 0;
  while (!worker.isRunning() && retries < 10) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    retries++;
  }

  if (!worker.isRunning()) {
    throw new Error("Worker is not running");
  }

  // Give worker time to fully initialize and subscribe to queue
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Create a test job in the database
  const [job] = await db
    .insert(scanJobs)
    .values({
      userId: TEST_USER_ID,
      url: "https://example.com",
      state: "QUEUED",
      version: 1,
    })
    .returning();

  // Set up event listener to track when job is processed
  let jobProcessed = false;
  const workerInstance = worker;

  const activeHandler = () => {
    jobProcessed = true;
    console.log("[TEST] Worker started processing a job");
  };

  if (workerInstance) {
    workerInstance.on("active", activeHandler);
  }

  // Add job to queue
  const queueJob = await scanQueue.add("scan-url", {
    jobId: job.id,
    url: "https://example.com",
    userId: TEST_USER_ID,
  });

  console.log(
    `[TEST] Added job ${job.id} to queue (queue job ID: ${queueJob.id})`
  );

  // Poll for job state change (wait up to 15 seconds to account for container execution)
  let jobState = "QUEUED";
  const maxWaitTime = 15000; // 15 seconds
  const pollInterval = 200; // Check every 200ms
  const startTime = Date.now();

  while (jobState === "QUEUED" && Date.now() - startTime < maxWaitTime) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const updatedJob = await db
      .select()
      .from(scanJobs)
      .where(eq(scanJobs.id, job.id))
      .limit(1);

    if (updatedJob.length > 0) {
      jobState = updatedJob[0].state;
      if (jobState !== "QUEUED") {
        console.log(`[TEST] Job state changed to: ${jobState}`);
        break;
      }
    }
  }

  // Clean up event listener
  if (workerInstance) {
    workerInstance.off("active", activeHandler);
  }

  // Check job state (should have transitioned from QUEUED)
  const finalJob = await db
    .select()
    .from(scanJobs)
    .where(eq(scanJobs.id, job.id))
    .limit(1);

  expect(finalJob.length).toBe(1);

  // Job should have been picked up (state changed from QUEUED)
  // Note: It might be FETCHING, ANALYZING, COMPLETED, or FAILED depending on container execution
  expect(finalJob[0].state).not.toBe("QUEUED");

  console.log(`[TEST] Final job state: ${finalJob[0].state}`);

  // Clean up
  await db.delete(scanJobs).where(eq(scanJobs.id, job.id));
}, 30000);

test("worker handles queue events", async () => {
  if (!worker) {
    throw new Error("Worker not initialized");
  }

  let jobCompleted = false;
  let jobFailed = false;
  let eventReceived = false;

  // Set up event listeners BEFORE adding job to ensure we catch events
  const completedHandler = () => {
    jobCompleted = true;
    eventReceived = true;
    console.log("[TEST] Worker event: job completed");
  };

  const failedHandler = (job: any, err: Error) => {
    jobFailed = true;
    eventReceived = true;
    console.log(`[TEST] Worker event: job failed: ${err.message}`);
  };

  worker.on("completed", completedHandler);
  worker.on("failed", failedHandler);

  // Create and queue a job
  const [job] = await db
    .insert(scanJobs)
    .values({
      userId: TEST_USER_ID,
      url: "https://example.com",
      state: "QUEUED",
      version: 1,
    })
    .returning();

  await scanQueue.add("scan-url", {
    jobId: job.id,
    url: "https://example.com",
    userId: TEST_USER_ID,
  });

  console.log(`[TEST] Added job ${job.id} to queue, waiting for events...`);

  // Wait for worker to process (or fail) - poll for event or timeout
  const maxWaitTime = 15000; // 15 seconds
  const pollInterval = 200; // Check every 200ms
  const startTime = Date.now();

  while (!eventReceived && Date.now() - startTime < maxWaitTime) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  // Clean up event listeners
  worker.off("completed", completedHandler);
  worker.off("failed", failedHandler);

  // Worker should have emitted an event (either completed or failed)
  expect(jobCompleted || jobFailed).toBe(true);

  console.log(
    `[TEST] Worker processed job: completed=${jobCompleted}, failed=${jobFailed}`
  );

  // Clean up
  await db.delete(scanJobs).where(eq(scanJobs.id, job.id));
}, 30000);
