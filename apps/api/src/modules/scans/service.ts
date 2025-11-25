import { Result, ResultAsync, ok, err } from "@safeurl/core/result";
import { wrapDbQuery } from "@safeurl/core/result";
import { db, scanJobs, wallets, scanResults } from "@safeurl/db";
import { eq } from "drizzle-orm";
import { scanQueue } from "../../lib/queue";
import type { CreateScanRequest } from "./schemas";

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
 */
async function checkCredits(
  userId: string,
  requiredCredits: number = 1
): Promise<Result<{ balance: number }, ServiceError>> {
  return wrapDbQuery(async () => {
    const userWallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (userWallet.length === 0) {
      return err({
        code: "wallet_not_found",
        message: "User wallet not found",
      });
    }

    const wallet = userWallet[0];
    if (wallet.creditBalance < requiredCredits) {
      return err({
        code: "insufficient_credits",
        message: `Insufficient credits. Required: ${requiredCredits}, Available: ${wallet.creditBalance}`,
        details: {
          required: requiredCredits,
          available: wallet.creditBalance,
        },
      });
    }

    return ok({ balance: wallet.creditBalance });
  }).andThen((result) => {
    if (result.isErr()) {
      return ResultAsync.fromSafePromise(
        Promise.resolve(err(result.error))
      );
    }
    return ResultAsync.fromSafePromise(Promise.resolve(result));
  });
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
    return creditCheck;
  }

  // Create job and decrement credits in a transaction
  return wrapDbQuery(async () => {
    return await db.transaction(async (tx) => {
      // Get wallet
      const wallet = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1);

      if (wallet.length === 0) {
        throw new Error("Wallet not found");
      }

      const currentBalance = wallet[0].creditBalance;
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
  }).andThen(async (result) => {
    if (result.isErr()) {
      return err({
        code: "database_error",
        message: result.error.message,
        details: result.error,
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
  });
}

/**
 * Get scan job by ID
 */
export async function getScanJob(
  jobId: string,
  userId: string
): Promise<Result<ScanJobWithResult, ServiceError>> {
  return wrapDbQuery(async () => {
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
      return err({
        code: "not_found",
        message: "Scan job not found",
      });
    }

    const scanJob = job[0];

    // Check authorization
    if (scanJob.userId !== userId) {
      return err({
        code: "authorization_error",
        message: "Not authorized to access this scan job",
      });
    }

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

    return ok({
      ...scanJob,
      result,
    });
  }).andThen((result) => {
    if (result.isErr()) {
      return ResultAsync.fromSafePromise(
        Promise.resolve(err(result.error))
      );
    }
    return ResultAsync.fromSafePromise(Promise.resolve(result));
  });
}

/**
 * Scan job with optional result
 */
export interface ScanJobWithResult {
  id: string;
  userId: string;
  url: string;
  state: string;
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
