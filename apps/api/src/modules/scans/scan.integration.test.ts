/**
 * Integration test for URL scan API endpoint
 *
 * This test covers the same case as packages/mastra/src/agents/url-safety-agent.test.ts
 * but tests the full API integration including:
 * - Creating a scan job via POST /v1/scans
 * - Polling for scan results via GET /v1/scans/:id
 * - Verifying the structured response matches expected format
 *
 * Prerequisites:
 * - Redis must be running (for BullMQ queue)
 * - Worker service must be running to process scan jobs
 * - Database must be accessible (configured via DATABASE_URL)
 *
 * To run this test:
 *   1. Start Redis: redis-server
 *   2. Start the worker: cd apps/worker && bun dev
 *   3. Run the test: bun test apps/api/src/modules/scans/scan.integration.test.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  createDatabase,
  executeRawSQL,
  executeRawSQLString,
  users,
  wallets,
} from "@safeurl/db";
import type { Worker } from "bullmq";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";

import { app } from "../../app";

// Create database instance for tests
const dbInstance = createDatabase({
  url: process.env.TURSO_CONNECTION_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
const db = dbInstance.db;

/**
 * Dynamically import and create worker
 * Uses runtime import to avoid TypeScript path issues
 */
async function createWorkerInstance(): Promise<Worker | null> {
  try {
    // Use dynamic import with absolute path
    const projectRoot = process.cwd().includes("apps/api")
      ? join(process.cwd(), "../..")
      : process.cwd();
    const workerPath = join(projectRoot, "apps/worker/src/queue/processor.ts");
    const workerModule = await import(workerPath);
    return workerModule.createWorker();
  } catch (error: any) {
    console.warn(`[TEST] Could not import worker: ${error?.message}`);
    console.warn(
      "[TEST] Worker will need to be started externally for tests to pass",
    );
    return null;
  }
}

// Use the same default user ID as the API (when auth is disabled)
const TEST_USER_ID = "user_anonymous";
const TEST_IMAGE_URL = "https://i.4cdn.org/cgl/1683919741567583.jpg";

// Worker instance for processing jobs during tests
let worker: Worker | null = null;

/**
 * Run database migrations from SQL file
 * This ensures the database schema is set up before tests run
 */
async function runMigrations() {
  // Get the path relative to the project root
  // When running from apps/api, we need to go up to the root
  const projectRoot = process.cwd().includes("apps/api")
    ? join(process.cwd(), "../..")
    : process.cwd();
  const migrationPath = join(
    projectRoot,
    "packages/db/migrations/0000_flowery_jazinda.sql",
  );

  try {
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    // Split by statement-breakpoint and execute each statement
    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed) {
        try {
          // Execute raw SQL string directly
          await executeRawSQLString(dbInstance, trimmed);
        } catch (error: any) {
          // Ignore errors for tables/indexes that already exist
          const errorMsg = error?.message?.toLowerCase() || "";
          if (
            !errorMsg.includes("already exists") &&
            !errorMsg.includes("duplicate")
          ) {
            // Only log non-expected errors (but don't fail the test)
            // Some statements might fail if objects already exist, which is fine
            console.warn(
              `Migration statement warning: ${errorMsg.substring(0, 100)}`,
            );
          }
        }
      }
    }
  } catch (error: any) {
    // If migration file doesn't exist or can't be read, try to continue
    // The test will fail with a clearer error if tables don't exist
    console.warn(`Could not run migrations: ${error?.message}`);
  }
}

/**
 * Ensure test user has sufficient credits
 */
async function ensureTestUserCredits(credits: number = 100) {
  // Ensure user exists
  try {
    await executeRawSQL(
      dbInstance,
      sql`INSERT OR IGNORE INTO users (clerk_user_id) VALUES (${TEST_USER_ID})`,
    );
  } catch (error) {
    // User might already exist, try regular insert for non-SQLite
    try {
      await db.insert(users).values({
        clerkUserId: TEST_USER_ID,
      });
    } catch {
      // User exists, continue
    }
  }

  // Ensure wallet exists and has credits
  const existingWallet = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, TEST_USER_ID))
    .limit(1);

  if (existingWallet.length === 0) {
    await db.insert(wallets).values({
      userId: TEST_USER_ID,
      creditBalance: credits,
    });
  } else {
    await db
      .update(wallets)
      .set({ creditBalance: credits })
      .where(eq(wallets.userId, TEST_USER_ID));
  }
}

/**
 * Poll for scan result until completed or timeout
 */
async function pollScanResult(
  scanId: string,
  timeoutMs: number = 120_000,
  pollIntervalMs: number = 1000,
): Promise<any> {
  const startTime = Date.now();
  let lastState = "";

  while (Date.now() - startTime < timeoutMs) {
    const response = await app.handle(
      new Request(`http://localhost/v1/scans/${scanId}`, {
        method: "GET",
      }),
    );

    if (!response.ok) {
      throw new Error(`Failed to get scan result: ${response.status}`);
    }

    const data = (await response.json()) as {
      id: string;
      url: string;
      state: string;
      result?: any;
    };

    // Log state changes for debugging
    if (data.state !== lastState) {
      console.log(`[TEST] Scan ${scanId} state: ${lastState} -> ${data.state}`);
      lastState = data.state;
    }

    if (data.state === "COMPLETED") {
      return data;
    }

    if (data.state === "FAILED" || data.state === "TIMED_OUT") {
      throw new Error(`Scan failed with state: ${data.state}`);
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Scan did not complete within ${timeoutMs}ms timeout. Last state: ${lastState}`,
  );
}

beforeAll(async () => {
  // Run database migrations first
  await runMigrations();

  // Ensure test user has credits
  await ensureTestUserCredits(100);

  // Start worker to process jobs during tests
  // Note: This requires Redis to be running and Docker to be available
  console.log("[TEST] Starting worker to process scan jobs...");
  worker = await createWorkerInstance();
  if (worker) {
    console.log("[TEST] Worker started successfully");
  } else {
    console.warn(
      "[TEST] Worker not available - make sure Redis is running and Docker is available",
    );
    console.warn(
      "[TEST] You may need to start the worker externally: cd apps/worker && bun dev",
    );
  }
});

afterAll(async () => {
  // Stop worker
  if (worker) {
    console.log("[TEST] Stopping worker...");
    try {
      await worker.close();
      console.log("[TEST] Worker stopped successfully");
    } catch (error: any) {
      console.warn(`[TEST] Error stopping worker: ${error?.message}`);
    }
  }

  // Clean up test user wallet (optional, can leave for debugging)
  // await db.delete(wallets).where(eq(wallets.userId, TEST_USER_ID));
  // await db.delete(users).where(eq(users.clerkUserId, TEST_USER_ID));
});

test("should analyze image URL and return structured scan result", async () => {
  // Step 1: Create scan job
  const createResponse = await app.handle(
    new Request("http://localhost/v1/scans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: TEST_IMAGE_URL,
      }),
    }),
  );

  expect(createResponse.status).toBe(201);
  const createData = (await createResponse.json()) as {
    id: string;
    state: string;
  };
  expect(createData.id).toBeDefined();
  expect(createData.state).toBe("QUEUED");

  const scanId = createData.id;
  console.log(`[TEST] Created scan job: ${scanId}`);

  // Step 2: Poll for scan result until completed
  console.log(`[TEST] Polling for scan result...`);
  const scanResult = await pollScanResult(scanId, 120_000);

  // Step 3: Verify scan result structure matches Mastra test expectations
  expect(scanResult).toBeDefined();
  expect(scanResult.id).toBe(scanId);
  expect(scanResult.url).toBe(TEST_IMAGE_URL);
  expect(scanResult.state).toBe("COMPLETED");
  expect(scanResult.result).toBeDefined();

  const result = scanResult.result;

  // Verify structured output (same as Mastra test)
  expect(result.riskScore).toBeDefined();
  expect(typeof result.riskScore).toBe("number");
  expect(result.riskScore).toBeGreaterThanOrEqual(0);
  expect(result.riskScore).toBeLessThanOrEqual(100);

  expect(result.categories).toBeDefined();
  expect(Array.isArray(result.categories)).toBe(true);
  expect(result.categories.length).toBeGreaterThan(0);

  expect(result.confidenceScore).toBeDefined();
  expect(typeof result.confidenceScore).toBe("number");
  expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
  expect(result.confidenceScore).toBeLessThanOrEqual(1);

  expect(result.reasoning).toBeDefined();
  expect(typeof result.reasoning).toBe("string");
  expect(result.reasoning.length).toBeGreaterThan(0);

  expect(result.indicators).toBeDefined();
  expect(Array.isArray(result.indicators)).toBe(true);

  // Verify that visual/screenshot analysis was likely used
  // (similar to Mastra test verification)
  const reasoning = result.reasoning.toLowerCase();
  const hasVisualAnalysis =
    reasoning.includes("screenshot") ||
    reasoning.includes("visual") ||
    reasoning.includes("image") ||
    reasoning.includes("nsfw") ||
    reasoning.includes("content");

  console.log("Visual analysis indicators:", {
    reasoning: reasoning.substring(0, 200),
    hasVisualAnalysis,
    riskScore: result.riskScore,
    categories: result.categories,
  });

  // Additional API-specific fields
  expect(result.contentHash).toBeDefined();
  expect(typeof result.contentHash).toBe("string");
  expect(result.modelUsed).toBeDefined();
  expect(typeof result.modelUsed).toBe("string");

  console.log("✅ Scan result verified:", {
    riskScore: result.riskScore,
    categories: result.categories,
    confidenceScore: result.confidenceScore,
    modelUsed: result.modelUsed,
  });
}, 120_000); // 120 second timeout to match Mastra test
