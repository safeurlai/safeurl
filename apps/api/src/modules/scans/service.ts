import { Result, ok, err } from "@safeurl/core/result";
import { wrapDbQuery } from "@safeurl/core/result";
import {
  db,
  scanJobs,
  wallets,
  scanResults,
  users,
  executeRawSQL,
} from "@safeurl/db";
import { eq, sql } from "drizzle-orm";
import { scanQueue } from "../../lib/queue";
import type { CreateScanRequest } from "./schemas";

/**
 * Ensure user exists in database
 * Uses INSERT OR IGNORE for atomic user creation
 */
async function ensureUserExists(userId: string): Promise<void> {
  try {
    // Try to insert user, ignore if already exists (SQLite specific)
    await executeRawSQL(
      sql`INSERT OR IGNORE INTO users (clerk_user_id) VALUES (${userId})`
    );
  } catch (error) {
    // If INSERT OR IGNORE fails, try regular insert (for non-SQLite databases)
    try {
      await db.insert(users).values({
        clerkUserId: userId,
      });
    } catch (insertError) {
      // User might already exist, verify by selecting
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.clerkUserId, userId))
        .limit(1);
      if (existing.length === 0) {
        // User doesn't exist and insert failed, re-throw
        throw insertError;
      }
      // User exists now, continue
    }
  }
}

/**
 * Service errors
 */
interface ServiceError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Check if user has sufficient credits
 * Creates user and wallet if they don't exist
 */
async function checkCredits(
  userId: string,
  requiredCredits: number = 1
): Promise<Result<{ balance: number }, ServiceError>> {
  const resultAsync = wrapDbQuery(async () => {
    // Ensure user exists
    await ensureUserExists(userId);

    // Check if wallet exists, create if it doesn't
    let userWallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    let wallet;
    if (userWallet.length === 0) {
      // Create wallet with 0 credits if it doesn't exist
      // Handle race condition: if another request creates the wallet between check and insert
      try {
        const [newWallet] = await db
          .insert(wallets)
          .values({
            userId,
            creditBalance: 0,
          })
          .returning();
        wallet = newWallet;
      } catch (error: unknown) {
        // If insert fails (e.g., unique constraint), wallet was created by another request
        // Re-check to get the wallet
        userWallet = await db
          .select()
          .from(wallets)
          .where(eq(wallets.userId, userId))
          .limit(1);
        if (userWallet.length === 0) {
          // If still not found, re-throw the error
          throw error;
        }
        wallet = userWallet[0];
      }
    } else {
      wallet = userWallet[0];
    }

    if (wallet.creditBalance < requiredCredits) {
      throw new Error(
        `Insufficient credits. Required: ${requiredCredits}, Available: ${wallet.creditBalance}`
      );
    }

    return { balance: wallet.creditBalance };
  });

  // Await the ResultAsync and convert DatabaseError to ServiceError
  const result = await resultAsync;

  if (result.isErr()) {
    const dbError = result.error;
    const errorMessage = dbError.message || "Database error occurred";

    // Check if it's an insufficient credits error
    if (errorMessage.includes("Insufficient credits")) {
      const match = errorMessage.match(/Required: (\d+), Available: (\d+)/);
      return err({
        code: "insufficient_credits",
        message: errorMessage,
        details: match
          ? {
              required: parseInt(match[1], 10),
              available: parseInt(match[2], 10),
            }
          : undefined,
      });
    }

    return err({
      code: `database_${dbError.type}_error`,
      message: errorMessage,
      details: dbError,
    });
  }

  return ok(result.value);
}

/**
 * Create scan job and decrement credits atomically
 */
export async function createScanJob(
  userId: string,
  request: CreateScanRequest
): Promise<Result<{ id: string; state: string }, ServiceError>> {
  const CREDIT_COST = 1; // Cost per scan

  // Check credits first (before transaction)
  const creditCheck = await checkCredits(userId, CREDIT_COST);
  if (creditCheck.isErr()) {
    return err(creditCheck.error);
  }

  // Create job and decrement credits in a transaction
  const resultAsync = wrapDbQuery(async () => {
    // Ensure user exists before transaction
    await ensureUserExists(userId);

    return await db.transaction(async (tx) => {
      // Get or create wallet
      const wallet = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1);

      let currentBalance: number;
      if (wallet.length === 0) {
        // Create wallet with 0 credits if it doesn't exist
        const [newWallet] = await tx
          .insert(wallets)
          .values({
            userId,
            creditBalance: 0,
          })
          .returning();
        currentBalance = newWallet.creditBalance;
      } else {
        currentBalance = wallet[0].creditBalance;
      }

      if (currentBalance < CREDIT_COST) {
        throw new Error(
          `Insufficient credits. Required: ${CREDIT_COST}, Available: ${currentBalance}`
        );
      }

      // Create scan job
      const [scanJob] = await tx
        .insert(scanJobs)
        .values({
          userId,
          url: request.url,
          state: "QUEUED",
          version: 1,
        })
        .returning();

      // Decrement credits
      await tx
        .update(wallets)
        .set({
          creditBalance: currentBalance - CREDIT_COST,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, userId));

      return {
        id: scanJob.id,
        state: scanJob.state,
      };
    });
  });

  // Await the ResultAsync and convert DatabaseError to ServiceError
  const result = await resultAsync;

  if (result.isErr()) {
    const dbError = result.error;
    const errorMessage = dbError.message || "Database error occurred";

    // Check if it's an insufficient credits error
    if (errorMessage.includes("Insufficient credits")) {
      return err({
        code: "insufficient_credits",
        message: errorMessage,
        details: dbError,
      });
    }

    return err({
      code: `database_${dbError.type}_error`,
      message: errorMessage,
      details: dbError,
    });
  }

  const jobData = result.value;

  // Enqueue job
  try {
    await scanQueue.add("scan-url", {
      jobId: jobData.id,
      url: request.url,
      userId,
    });
  } catch (error) {
    // If queue fails, we should ideally rollback the transaction
    // But since we're already committed, we log the error
    console.error("Failed to enqueue scan job:", error);
    return err({
      code: "queue_error",
      message: "Failed to enqueue scan job",
      details: error,
    });
  }

  return ok(jobData);
}

/**
 * Get scan job by ID
 */
export async function getScanJob(
  jobId: string,
  userId: string
): Promise<Result<ScanJobWithResult, ServiceError>> {
  const resultAsync = wrapDbQuery(async () => {
    const job = await db
      .select({
        id: scanJobs.id,
        userId: scanJobs.userId,
        url: scanJobs.url,
        state: scanJobs.state,
        createdAt: scanJobs.createdAt,
        updatedAt: scanJobs.updatedAt,
        version: scanJobs.version,
      })
      .from(scanJobs)
      .where(eq(scanJobs.id, jobId))
      .limit(1);

    if (job.length === 0) {
      throw new Error("Scan job not found");
    }

    const scanJob = job[0];

    // No authorization check - all users can access any scan job

    // Get scan result if available
    let result = null;
    if (scanJob.state === "COMPLETED") {
      const scanResult = await db
        .select()
        .from(scanResults)
        .where(eq(scanResults.jobId, jobId))
        .limit(1);

      if (scanResult.length > 0) {
        result = scanResult[0];
      }
    }

    return {
      ...scanJob,
      result,
    };
  });

  // Await the ResultAsync and convert DatabaseError to ServiceError
  const result = await resultAsync;

  if (result.isErr()) {
    const dbError = result.error;
    const errorMessage = dbError.message || "Database error occurred";

    // Check if it's a not found error
    if (errorMessage.includes("not found")) {
      return err({
        code: "not_found",
        message: "Scan job not found",
      });
    }

    return err({
      code: `database_${dbError.type}_error`,
      message: errorMessage,
      details: dbError,
    });
  }

  return ok(result.value);
}

/**
 * Scan job with optional result
 */
export interface ScanJobWithResult {
  id: string;
  userId: string;
  url: string;
  state:
    | "QUEUED"
    | "FETCHING"
    | "ANALYZING"
    | "COMPLETED"
    | "FAILED"
    | "TIMED_OUT";
  createdAt: Date;
  updatedAt: Date;
  version: number;
  result?: {
    riskScore: number;
    categories: string[];
    reasoning: string;
    indicators: string[];
    contentHash: string;
    httpStatus: number | null;
    httpHeaders: Record<string, string> | null;
    contentType: string | null;
    modelUsed: string;
    analysisMetadata: Record<string, unknown> | null;
  } | null;
}
