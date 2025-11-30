#!/usr/bin/env bun

/**
 * Manual worker test script
 *
 * This script creates a test job and monitors the worker processing it.
 * Useful for quick verification that the worker is functioning.
 *
 * Usage:
 *   1. Start Redis: docker-compose up -d redis (or redis-server)
 *   2. Start worker in another terminal: cd apps/worker && bun dev
 *   3. Run this script: bun run apps/worker/test-worker-manual.ts
 */
import {
  createDatabase,
  executeRawSQLString,
  scanJobs,
  users,
  wallets,
} from "@safeurl/db";
import { Queue } from "bullmq";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

// Create database instance
const dbInstance = createDatabase({
  url: process.env.TURSO_CONNECTION_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
const db = dbInstance.db;

const TEST_USER_ID = "test_manual_user";
const TEST_URL = "https://example.com";

// Create queue connection
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

const scanQueue = new Queue("scan-jobs", {
  connection: redisConnection,
});

async function setupTestUser() {
  try {
    await executeRawSQLString(
      dbInstance,
      `INSERT OR IGNORE INTO users (clerk_user_id) VALUES ('${TEST_USER_ID}')`,
    );
  } catch (error) {
    try {
      await db.insert(users).values({
        clerkUserId: TEST_USER_ID,
      });
    } catch {
      // User exists
    }
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
}

async function main() {
  console.log("🧪 Manual Worker Test");
  console.log("====================");
  console.log("");

  // Check Redis connection
  try {
    await redisConnection.ping();
    console.log("✅ Connected to Redis");
  } catch (error) {
    console.error("❌ Failed to connect to Redis:", error);
    process.exit(1);
  }

  // Setup test user
  await setupTestUser();
  console.log("✅ Test user setup complete");

  // Create a test job
  console.log("");
  console.log("📝 Creating test job...");
  const [job] = await db
    .insert(scanJobs)
    .values({
      userId: TEST_USER_ID,
      url: TEST_URL,
      state: "QUEUED",
      version: 1,
    })
    .returning();

  console.log(`✅ Created job: ${job.id}`);
  console.log(`   URL: ${TEST_URL}`);
  console.log(`   State: ${job.state}`);

  // Add job to queue
  console.log("");
  console.log("📤 Adding job to queue...");
  const queueJob = await scanQueue.add("scan-url", {
    jobId: job.id,
    url: TEST_URL,
    userId: TEST_USER_ID,
  });
  console.log(`✅ Job added to queue: ${queueJob.id}`);

  // Monitor job state
  console.log("");
  console.log("👀 Monitoring job state (checking every 2 seconds)...");
  console.log("   Make sure the worker is running in another terminal!");
  console.log("");

  let lastState = job.state;
  const startTime = Date.now();
  const timeout = 60000; // 60 seconds

  while (Date.now() - startTime < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const updatedJob = await db
      .select()
      .from(scanJobs)
      .where(eq(scanJobs.id, job.id))
      .limit(1);

    if (updatedJob.length === 0) {
      console.log("⚠️  Job not found in database");
      break;
    }

    const currentState = updatedJob[0].state;
    if (currentState !== lastState) {
      console.log(`   State changed: ${lastState} → ${currentState}`);
      lastState = currentState;
    }

    if (currentState === "COMPLETED") {
      console.log("");
      console.log("✅ SUCCESS! Job completed successfully!");
      console.log(`   Final state: ${currentState}`);
      break;
    }

    if (currentState === "FAILED" || currentState === "TIMED_OUT") {
      console.log("");
      console.log(`❌ Job failed with state: ${currentState}`);
      break;
    }

    process.stdout.write(".");
  }

  console.log("");
  console.log("");

  // Final status
  const finalJob = await db
    .select()
    .from(scanJobs)
    .where(eq(scanJobs.id, job.id))
    .limit(1);

  if (finalJob.length > 0) {
    console.log(`📊 Final job state: ${finalJob[0].state}`);
  }

  // Cleanup
  await scanQueue.close();
  await redisConnection.quit();
  console.log("");
  console.log("✨ Test complete!");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
