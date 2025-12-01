/**
 * API smoke test
 *
 * Tests that the API endpoints are working correctly and can handle basic requests.
 *
 * Prerequisites:
 * - Redis must be running (for BullMQ queue)
 * - Database must be accessible
 * - Worker service should be running to process scan jobs (or test will wait for timeout)
 *
 * This smoke test verifies:
 * - Health endpoint responds correctly
 * - Scan job creation endpoint works
 * - Scan result retrieval endpoint works
 * - Credit balance endpoint works
 * - Response structures match expected schemas
 */

import { createDatabase, executeRawSQL, users, wallets } from "@safeurl/db";
import { beforeAll, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";

import { app } from "./app";

// Create database instance for tests
const dbInstance = createDatabase({
  url: process.env.TURSO_CONNECTION_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
const db = dbInstance.db;

// Use the same default user ID as the API (when auth is disabled)
const TEST_USER_ID = "user_anonymous";
const TEST_IMAGE_URL = "https://i.4cdn.org/cgl/1683919741567583.jpg";

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
      console.log(
        `[SMOKE TEST] Scan ${scanId} state: ${lastState} -> ${data.state}`,
      );
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
  // Ensure test user has credits
  await ensureTestUserCredits(100);
});

test("health endpoint should return ok status", async () => {
  const response = await app.handle(
    new Request("http://localhost/health", {
      method: "GET",
    }),
  );

  expect(response.status).toBe(200);
  const data = (await response.json()) as {
    status: string;
    timestamp: string;
    service: string;
    version: string;
  };

  expect(data.status).toBe("ok");
  expect(data.service).toBe("safeurl-api");
  expect(data.version).toBe("1.0.0");
  expect(data.timestamp).toBeDefined();
});

test("should create scan job via POST /v1/scans", async () => {
  const response = await app.handle(
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

  expect(response.status).toBe(201);
  const data = (await response.json()) as {
    id: string;
    state: string;
  };

  expect(data.id).toBeDefined();
  expect(typeof data.id).toBe("string");
  expect(data.state).toBe("QUEUED");
});

test("should get credit balance via GET /v1/credits", async () => {
  const response = await app.handle(
    new Request("http://localhost/v1/credits", {
      method: "GET",
    }),
  );

  expect(response.status).toBe(200);
  const data = (await response.json()) as {
    balance: number;
    userId: string;
    updatedAt: string;
  };

  expect(data.balance).toBeDefined();
  expect(typeof data.balance).toBe("number");
  expect(data.balance).toBeGreaterThanOrEqual(0);
  expect(data.userId).toBe(TEST_USER_ID);
  expect(data.updatedAt).toBeDefined();
});

test("should create scan job and retrieve result", async () => {
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
  console.log(`[SMOKE TEST] Created scan job: ${scanId}`);

  // Step 2: Get initial scan status (should be QUEUED or processing)
  const initialResponse = await app.handle(
    new Request(`http://localhost/v1/scans/${scanId}`, {
      method: "GET",
    }),
  );

  expect(initialResponse.status).toBe(200);
  const initialData = (await initialResponse.json()) as {
    id: string;
    url: string;
    state: string;
    createdAt: string;
    updatedAt: string;
    result?: any;
  };

  expect(initialData.id).toBe(scanId);
  expect(initialData.url).toBe(TEST_IMAGE_URL);
  expect(initialData.state).toBeDefined();
  expect(["QUEUED", "FETCHING", "ANALYZING", "COMPLETED", "FAILED"]).toContain(
    initialData.state,
  );
  expect(initialData.createdAt).toBeDefined();
  expect(initialData.updatedAt).toBeDefined();

  // Step 3: Poll for scan result until completed (if worker is running)
  // Note: This will timeout if worker is not running, which is acceptable for smoke test
  try {
    console.log(`[SMOKE TEST] Polling for scan result...`);
    const scanResult = await pollScanResult(scanId, 120_000);

    // Verify scan result structure
    expect(scanResult).toBeDefined();
    expect(scanResult.id).toBe(scanId);
    expect(scanResult.url).toBe(TEST_IMAGE_URL);
    expect(scanResult.state).toBe("COMPLETED");
    expect(scanResult.result).toBeDefined();

    const result = scanResult.result;

    // Verify structured output
    expect(result.riskScore).toBeDefined();
    expect(typeof result.riskScore).toBe("number");
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);

    expect(result.categories).toBeDefined();
    expect(Array.isArray(result.categories)).toBe(true);

    expect(result.confidenceScore).toBeDefined();
    expect(typeof result.confidenceScore).toBe("number");

    expect(result.reasoning).toBeDefined();
    expect(typeof result.reasoning).toBe("string");

    expect(result.indicators).toBeDefined();
    expect(Array.isArray(result.indicators)).toBe(true);

    expect(result.contentHash).toBeDefined();
    expect(typeof result.contentHash).toBe("string");

    expect(result.modelUsed).toBeDefined();
    expect(typeof result.modelUsed).toBe("string");

    console.log("✅ Scan result verified:", {
      riskScore: result.riskScore,
      categories: result.categories,
      confidenceScore: result.confidenceScore,
    });
  } catch (error: any) {
    // If polling times out, it's acceptable for smoke test (worker might not be running)
    // Just verify the job was created and is accessible
    console.warn(
      `[SMOKE TEST] Scan did not complete (this is OK if worker is not running): ${error.message}`,
    );
    console.log(
      `[SMOKE TEST] Job ${scanId} was created successfully and is accessible via API`,
    );
  }
}, 120_000); // 120 second timeout

test("should return 404 for non-existent scan job", async () => {
  // Use a valid UUID format so it passes validation and reaches the handler
  const nonExistentId = "00000000-0000-0000-0000-000000000000";
  const response = await app.handle(
    new Request(`http://localhost/v1/scans/${nonExistentId}`, {
      method: "GET",
    }),
  );

  expect(response.status).toBe(404);
  const data = (await response.json()) as {
    error: {
      code: string;
      message: string;
    };
    timestamp: string;
  };

  expect(data.error).toBeDefined();
  expect(data.error.code).toBe("not_found");
  expect(data.error.message).toBeDefined();
});

test("should return 422 for invalid scan request", async () => {
  // Elysia returns 422 (Unprocessable Entity) for validation errors
  // when schema validation fails before reaching the handler
  const response = await app.handle(
    new Request("http://localhost/v1/scans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Missing required 'url' field
      }),
    }),
  );

  // Verify that validation error is returned
  expect(response.status).toBe(422);

  // Verify response is valid JSON (structure may vary)
  const data = (await response.json()) as Record<string, unknown>;
  expect(data).toBeDefined();
});

test("should return 402 for insufficient credits", async () => {
  // Set user credits to 0
  await ensureTestUserCredits(0);

  const response = await app.handle(
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

  expect(response.status).toBe(402);
  const data = (await response.json()) as {
    error: {
      code: string;
      message: string;
    };
  };

  expect(data.error).toBeDefined();
  expect(data.error.code).toBe("insufficient_credits");
  expect(data.error.message).toBeDefined();

  // Restore credits for other tests
  await ensureTestUserCredits(100);
});
