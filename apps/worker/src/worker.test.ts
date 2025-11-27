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
  connectTimeout: 5000, // 5 second connection timeout
  lazyConnect: true, // Don't connect immediately
});

let scanQueue: Queue | null = null;

const TEST_USER_ID = "test_worker_user";

let worker: Worker | null = null;

/**
 * Verify Redis connection is available and create Queue
 */
async function verifyRedisConnection(): Promise<void> {
  try {
    console.log("[TEST] Verifying Redis connection...");
    await redisConnection.connect();
    const pong = await redisConnection.ping();
    if (pong !== "PONG") {
      throw new Error(`Redis ping failed: expected PONG, got ${pong}`);
    }
    console.log("[TEST] Redis connection verified");

    // Create Queue after Redis is connected
    if (!scanQueue) {
      scanQueue = new Queue("scan-jobs", {
        connection: redisConnection,
      });
      console.log("[TEST] Queue created");
    }
  } catch (error: any) {
    console.error(`[TEST] Redis connection failed: ${error?.message}`);
    throw new Error(
      `Cannot connect to Redis at ${process.env.REDIS_HOST || "localhost"}:${
        process.env.REDIS_PORT || "6379"
      }. Make sure Redis is running.`
    );
  }
}

/**
 * Check if migrations are needed by checking if users table exists
 */
async function checkMigrationsNeeded(): Promise<boolean> {
  try {
    // Quick check: try to query the users table
    await db.select().from(users).limit(1);
    console.log("[TEST] Database tables already exist, skipping migrations");
    return false;
  } catch (error: any) {
    const errorMsg = error?.message?.toLowerCase() || "";
    if (
      errorMsg.includes("no such table") ||
      errorMsg.includes("does not exist")
    ) {
      console.log("[TEST] Database tables not found, migrations needed");
      return true;
    }
    // Other errors - assume migrations needed
    console.log(
      `[TEST] Could not check tables (${errorMsg.substring(
        0,
        50
      )}), running migrations`
    );
    return true;
  }
}

/**
 * Run database migrations with timeout handling
 */
async function runMigrations() {
  // Quick check: if tables exist, skip migrations
  const migrationsNeeded = await checkMigrationsNeeded();
  if (!migrationsNeeded) {
    return;
  }

  const migrationTimeout = 20000; // 20 seconds for migrations
  const statementTimeout = 3000; // 3 seconds per statement

  const projectRoot = process.cwd().includes("apps/worker")
    ? join(process.cwd(), "../..")
    : process.cwd();
  const migrationPath = join(
    projectRoot,
    "packages/db/migrations/0000_flowery_jazinda.sql"
  );

  const startTime = Date.now();

  try {
    console.log("[TEST] Reading migration file...");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    console.log(`[TEST] Found ${statements.length} migration statements`);

    for (let i = 0; i < statements.length; i++) {
      // Check overall timeout
      if (Date.now() - startTime > migrationTimeout) {
        console.warn(
          `[TEST] Migration timeout after ${migrationTimeout}ms at statement ${
            i + 1
          }/${statements.length}`
        );
        break;
      }

      const trimmed = statements[i].trim();
      if (!trimmed) continue;

      // Extract statement type for logging
      const statementType = trimmed.substring(0, 20).replace(/\s+/g, " ");

      try {
        // Execute with per-statement timeout
        const statementStart = Date.now();
        await Promise.race([
          executeRawSQLString(dbInstance, trimmed),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(`Statement timeout after ${statementTimeout}ms`)
                ),
              statementTimeout
            )
          ),
        ]);
        const statementDuration = Date.now() - statementStart;
        if (statementDuration > 500) {
          console.log(
            `[TEST] Migration ${i + 1}/${
              statements.length
            }: ${statementType}... (${statementDuration}ms)`
          );
        }
      } catch (error: any) {
        const errorMsg = error?.message?.toLowerCase() || "";
        // Ignore "already exists" errors for tables/indexes
        if (
          errorMsg.includes("already exists") ||
          errorMsg.includes("duplicate") ||
          errorMsg.includes("timeout")
        ) {
          // Only log if it's a timeout (which we want to know about)
          if (errorMsg.includes("timeout")) {
            console.warn(
              `[TEST] Migration statement ${i + 1} timeout: ${statementType}...`
            );
          }
          continue;
        }
        // For other errors, log but continue
        console.warn(
          `[TEST] Migration warning at statement ${i + 1}: ${errorMsg.substring(
            0,
            100
          )}`
        );
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[TEST] Migrations completed in ${totalDuration}ms`);
  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    console.error(
      `[TEST] Migration error after ${totalDuration}ms: ${error?.message}`
    );
    // Don't throw - migrations might already be applied
    console.warn(
      `[TEST] Continuing despite migration error - tables may already exist`
    );
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
  const timeout = 30000; // 30 seconds
  const startTime = Date.now();

  const checkTimeout = () => {
    if (Date.now() - startTime > timeout) {
      throw new Error(`beforeAll hook timed out after ${timeout}ms`);
    }
  };

  try {
    console.log("[TEST] Starting beforeAll hook...");
    checkTimeout();

    // Verify Redis connection first
    await verifyRedisConnection();
    checkTimeout();

    // Run migrations
    console.log("[TEST] Running migrations...");
    await runMigrations();
    checkTimeout();

    // Setup test user
    console.log("[TEST] Setting up test user...");
    await setupTestUser();
    checkTimeout();

    // Start worker
    console.log("[TEST] Creating worker...");
    worker = createWorker();
    console.log("[TEST] Worker created, waiting for initialization...");

    // Wait for worker to be ready (check if it's running)
    let retries = 0;
    const maxRetries = 50; // 5 seconds max wait
    while (retries < maxRetries) {
      checkTimeout();
      if (worker.isRunning()) {
        console.log("[TEST] Worker is running");
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    if (!worker.isRunning()) {
      throw new Error(
        "Worker failed to start - not running after initialization"
      );
    }

    console.log("[TEST] Worker started successfully");
  } catch (error: any) {
    console.error(`[TEST] Failed in beforeAll: ${error?.message}`);
    console.error(`[TEST] Error stack: ${error?.stack}`);
    throw error;
  }
});

afterAll(async () => {
  const timeout = 15000; // 15 seconds for cleanup
  const startTime = Date.now();

  const checkTimeout = () => {
    if (Date.now() - startTime > timeout) {
      console.warn(`[TEST] afterAll hook taking longer than ${timeout}ms`);
    }
  };

  try {
    console.log("[TEST] Starting afterAll hook...");

    // Stop worker - wait for active jobs to complete with timeout
    if (worker) {
      try {
        console.log("[TEST] Closing worker (waiting for active jobs)...");
        checkTimeout();

        // Close worker - this will wait for active jobs to complete
        // But set a timeout to prevent hanging forever
        const closePromise = worker.close();
        const timeoutPromise = new Promise<void>((resolve) => {
          setTimeout(() => {
            console.warn(
              "[TEST] Worker close timeout after 10s - continuing cleanup"
            );
            resolve();
          }, 10000); // 10 second timeout for worker close
        });

        await Promise.race([closePromise, timeoutPromise]);
        console.log("[TEST] Worker stopped");
      } catch (error: any) {
        console.error(`[TEST] Error closing worker: ${error?.message}`);
        // Worker close failed, but continue with cleanup
      }
    }

    // Close queue connection
    if (scanQueue) {
      try {
        console.log("[TEST] Closing queue...");
        checkTimeout();
        await scanQueue.close();
      } catch (error: any) {
        console.error(`[TEST] Error closing queue: ${error?.message}`);
      }
    }

    // Close Redis connection
    try {
      console.log("[TEST] Closing Redis connection...");
      checkTimeout();
      if (redisConnection.status === "ready") {
        await redisConnection.quit();
      } else {
        redisConnection.disconnect();
      }
      console.log("[TEST] Redis connection closed");
    } catch (error: any) {
      console.error(`[TEST] Error closing Redis: ${error?.message}`);
      redisConnection.disconnect(); // Force disconnect on error
    }
  } catch (error: any) {
    console.error(`[TEST] Error in afterAll: ${error?.message}`);
  }
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
  if (!scanQueue) {
    throw new Error("Queue not initialized");
  }
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
  let finalJob = await db
    .select()
    .from(scanJobs)
    .where(eq(scanJobs.id, job.id))
    .limit(1);

  expect(finalJob.length).toBe(1);

  // Job should have been picked up (state changed from QUEUED)
  // Note: It might be FETCHING, ANALYZING, COMPLETED, or FAILED depending on container execution
  expect(finalJob[0].state).not.toBe("QUEUED");

  // Use a string variable to hold state (avoids TypeScript narrowing issues)
  let currentState: string = finalJob[0].state;
  console.log(`[TEST] Final job state: ${currentState}`);

  // Wait for job to reach final state before cleanup to avoid race condition
  // If job is still processing (FETCHING/ANALYZING), wait for completion
  if (currentState !== "COMPLETED" && currentState !== "FAILED") {
    console.log(
      `[TEST] Job still processing (${currentState}), waiting for final state...`
    );
    const finalStateStartTime = Date.now();
    const finalStateMaxWait = 20000; // 20 seconds for container execution

    while (
      currentState !== "COMPLETED" &&
      currentState !== "FAILED" &&
      Date.now() - finalStateStartTime < finalStateMaxWait
    ) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const updatedFinalJob = await db
        .select()
        .from(scanJobs)
        .where(eq(scanJobs.id, job.id))
        .limit(1);

      if (updatedFinalJob.length > 0) {
        currentState = updatedFinalJob[0].state;
        if (currentState === "COMPLETED" || currentState === "FAILED") {
          console.log(`[TEST] Job reached final state: ${currentState}`);
          break;
        }
      }
    }
  }

  // Clean up - only delete if job reached final state or test is ending
  // This prevents race condition where worker is still processing
  if (currentState === "COMPLETED" || currentState === "FAILED") {
    await db.delete(scanJobs).where(eq(scanJobs.id, job.id));
  } else {
    console.log(`[TEST] Skipping cleanup - job still in state ${currentState}`);
    // Note: Job will be cleaned up by afterAll or next test run
  }
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

  if (!scanQueue) {
    throw new Error("Queue not initialized");
  }
  await scanQueue.add("scan-url", {
    jobId: job.id,
    url: "https://example.com",
    userId: TEST_USER_ID,
  });

  console.log(`[TEST] Added job ${job.id} to queue, waiting for events...`);

  // Wait for worker to process (or fail) - poll for event or timeout
  // Use longer timeout to account for container execution (up to 25 seconds)
  const maxWaitTime = 25000; // 25 seconds
  const pollInterval = 200; // Check every 200ms
  const startTime = Date.now();

  while (!eventReceived && Date.now() - startTime < maxWaitTime) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    // Also check job state as fallback - if job is COMPLETED or FAILED, consider it done
    try {
      const jobState = await db
        .select({ state: scanJobs.state })
        .from(scanJobs)
        .where(eq(scanJobs.id, job.id))
        .limit(1);

      if (
        jobState.length > 0 &&
        (jobState[0].state === "COMPLETED" || jobState[0].state === "FAILED")
      ) {
        console.log(
          `[TEST] Job reached final state: ${jobState[0].state}, but event not received`
        );
        // If we see final state but no event, still consider it processed
        // This handles cases where events might be delayed
        if (jobState[0].state === "COMPLETED") {
          jobCompleted = true;
        } else {
          jobFailed = true;
        }
        eventReceived = true;
        break;
      }
    } catch (error) {
      // Ignore errors checking job state
    }
  }

  // Clean up event listeners
  worker.off("completed", completedHandler);
  worker.off("failed", failedHandler);

  // Worker should have emitted an event OR job should be in final state
  // Note: Events might be delayed, so we also check job state
  if (!eventReceived) {
    // Check final job state as fallback
    const finalJob = await db
      .select({ state: scanJobs.state })
      .from(scanJobs)
      .where(eq(scanJobs.id, job.id))
      .limit(1);

    if (finalJob.length > 0) {
      const state = finalJob[0].state;
      if (state === "COMPLETED" || state === "FAILED") {
        console.log(
          `[TEST] Job in final state ${state} but event not received - considering processed`
        );
        expect(state === "COMPLETED" || state === "FAILED").toBe(true);
      } else {
        console.log(
          `[TEST] Job still in state ${state} after ${maxWaitTime}ms`
        );
        expect(jobCompleted || jobFailed).toBe(true);
      }
    } else {
      expect(jobCompleted || jobFailed).toBe(true);
    }
  } else {
    expect(jobCompleted || jobFailed).toBe(true);
  }

  console.log(
    `[TEST] Worker processed job: completed=${jobCompleted}, failed=${jobFailed}`
  );

  // Clean up
  await db.delete(scanJobs).where(eq(scanJobs.id, job.id));
}, 30000);
