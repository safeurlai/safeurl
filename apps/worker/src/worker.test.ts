import { test, expect, beforeAll, afterAll } from "bun:test";
import { createWorker } from "./queue/processor";
import { Queue } from "bullmq";
import Redis from "ioredis";
import {
  createDatabase,
  scanJobs,
  scanResults,
  wallets,
  users,
} from "@safeurl/db";
import { eq } from "drizzle-orm";
import type { Worker } from "bullmq";

const TEST_USER_ID = "test_worker_user";
const IMAGE_URL = "https://i.4cdn.org/cgl/1683919741567583.jpg";
const MAX_WAIT_TIME = 120_000;
const POLL_INTERVAL = 500;

const db = createDatabase({
  url: process.env.TURSO_CONNECTION_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
}).db;

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

const waitForWorker = async (worker: Worker, maxRetries = 50) => {
  for (let i = 0; i < maxRetries; i++) {
    if (worker.isRunning()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Worker failed to start");
};

const waitForJobCompletion = async (jobId: string) => {
  const startTime = Date.now();
  while (Date.now() - startTime < MAX_WAIT_TIME) {
    const [job] = await db
      .select({ state: scanJobs.state })
      .from(scanJobs)
      .where(eq(scanJobs.id, jobId))
      .limit(1);

    if (job && (job.state === "COMPLETED" || job.state === "FAILED")) {
      return job.state;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
  throw new Error("Job did not complete within timeout");
};

beforeAll(async () => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY environment variable is required");
  }

  await redisConnection.connect();
  if ((await redisConnection.ping()) !== "PONG") {
    throw new Error("Redis connection failed");
  }

  scanQueue = new Queue("scan-jobs", { connection: redisConnection });

  await db
    .insert(users)
    .values({ clerkUserId: TEST_USER_ID })
    .onConflictDoNothing();

  const existingWallet = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, TEST_USER_ID))
    .limit(1);

  if (existingWallet.length === 0) {
    await db
      .insert(wallets)
      .values({ userId: TEST_USER_ID, creditBalance: 100 });
  } else {
    await db
      .update(wallets)
      .set({ creditBalance: 100 })
      .where(eq(wallets.userId, TEST_USER_ID));
  }

  worker = createWorker();
  await waitForWorker(worker);
});

afterAll(async () => {
  if (worker) {
    await Promise.race([
      worker.close(),
      new Promise<void>((resolve) => setTimeout(resolve, 10000)),
    ]);
  }
  if (scanQueue) await scanQueue.close();
  if (redisConnection.status === "ready") {
    await redisConnection.quit();
  } else {
    redisConnection.disconnect();
  }

  try {
    await db.delete(scanJobs).where(eq(scanJobs.userId, TEST_USER_ID));
    await db.delete(wallets).where(eq(wallets.userId, TEST_USER_ID));
    await db.delete(users).where(eq(users.clerkUserId, TEST_USER_ID));
  } catch (error) {
    console.error("Error cleaning up test data:", error);
  }
});

test(
  "should analyze image URL and use screenshot-analysis tool",
  async () => {
    if (!worker || !scanQueue) {
      throw new Error("Worker or queue not initialized");
    }

    const [job] = await db
      .insert(scanJobs)
      .values({
        userId: TEST_USER_ID,
        url: IMAGE_URL,
        state: "QUEUED",
        version: 1,
      })
      .returning();

    await scanQueue.add("scan-url", {
      jobId: job.id,
      url: IMAGE_URL,
      userId: TEST_USER_ID,
    });

    const jobState = await waitForJobCompletion(job.id);
    expect(jobState).toBe("COMPLETED");

    const [scanResult] = await db
      .select()
      .from(scanResults)
      .where(eq(scanResults.jobId, job.id))
      .limit(1);

    expect(scanResult).toBeDefined();
    expect(scanResult).toMatchObject({
      riskScore: expect.any(Number),
      categories: expect.any(Array),
      reasoning: expect.any(String),
      indicators: expect.any(Array),
      contentHash: expect.any(String),
      httpStatus: expect.anything(),
    });
  },
  MAX_WAIT_TIME
);
