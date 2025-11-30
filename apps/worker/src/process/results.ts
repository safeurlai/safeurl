import { Result, ok, err } from "@safeurl/core/result";
import { wrapDbQuery } from "@safeurl/core/result";
import { db } from "../lib/db";
import { scanResults, auditLogs } from "@safeurl/db";
import { AuditLogger, type AuditLogError } from "@safeurl/core/audit";
import type { AuditLogCreation } from "@safeurl/core/audit";
import { eq } from "drizzle-orm";
import {
  transitionToAnalyzing,
  transitionToCompleted,
  getJobWithVersion,
} from "../state/transitions";
import type { ContainerExecutionResult } from "../container/manager";

/**
 * Result processing error types
 */
export interface ResultProcessingError {
  type: "state_transition_error" | "database_error" | "validation_error";
  message: string;
  details?: unknown;
}

/**
 * Audit log storage implementation using database
 */
class DatabaseAuditLogStorage {
  async append(entry: AuditLogCreation): Promise<Result<void, AuditLogError>> {
    console.log("[AUDIT LOG] Attempting to insert audit log entry:", {
      scanJobId: entry.scanJobId,
      urlAccessed: entry.urlAccessed,
      timestamp: entry.timestamp,
      contentHash: entry.contentHash?.substring(0, 16) + "...",
      hasHttpStatus: entry.httpStatus !== undefined,
      hasHttpHeaders: entry.httpHeaders !== undefined,
      hasContentType: entry.contentType !== undefined,
      hasRiskAssessment: entry.riskAssessmentSummary !== undefined,
    });

    return wrapDbQuery(async () => {
      try {
        const insertResult = await db.insert(auditLogs).values({
          scanJobId: entry.scanJobId,
          urlAccessed: entry.urlAccessed,
          timestamp: new Date(entry.timestamp),
          contentHash: entry.contentHash,
          httpStatus: entry.httpStatus ?? null,
          httpHeaders: entry.httpHeaders ?? null,
          contentType: entry.contentType ?? null,
          riskAssessmentSummary: entry.riskAssessmentSummary ?? null,
        });

        console.log("[AUDIT LOG] Insert successful:", insertResult);

        // Verify the audit log was actually written
        const verifyResult = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.scanJobId, entry.scanJobId))
          .limit(1);

        if (verifyResult.length === 0) {
          console.error(
            "[AUDIT LOG] WARNING: Insert appeared successful but audit log not found in database!"
          );
          throw new Error(
            "Audit log insert verification failed - log not found after insert"
          );
        } else {
          console.log(
            "[AUDIT LOG] Verification successful - audit log found in database:",
            {
              id: verifyResult[0].id,
              scanJobId: verifyResult[0].scanJobId,
              urlAccessed: verifyResult[0].urlAccessed,
            }
          );
        }

        // wrapDbQuery already wraps the return value in a Result
        return undefined;
      } catch (error) {
        console.error("[AUDIT LOG] Insert failed with error:", {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          entry: {
            scanJobId: entry.scanJobId,
            urlAccessed: entry.urlAccessed,
            timestamp: entry.timestamp,
            contentHash: entry.contentHash,
          },
        });
        throw error;
      }
    }).mapErr((error) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[AUDIT LOG] wrapDbQuery error:", {
        errorMessage,
        errorType: error?.type,
        errorDetails: error,
      });
      return {
        type: "storage" as const,
        message: errorMessage,
        cause: error,
      };
    });
  }
}

/**
 * Process scan results from container execution
 *
 * This function:
 * 1. Transitions state from FETCHING to ANALYZING
 * 2. Stores scan results in database
 * 3. Writes audit log entry
 * 4. Transitions state from ANALYZING to COMPLETED
 */
export async function processScanResults(
  jobId: string,
  containerResult: ContainerExecutionResult
): Promise<Result<void, ResultProcessingError>> {
  // Get current job version and URL
  const jobVersionResult = await getJobWithVersion(jobId);
  if (jobVersionResult.isErr()) {
    return err({
      type: "state_transition_error",
      message: jobVersionResult.error.message,
      details: jobVersionResult.error,
    });
  }

  const { version, job } = jobVersionResult.value;
  const urlAccessed = job.url;

  // Step 1: Transition FETCHING -> ANALYZING
  const transitionToAnalyzingResult = await transitionToAnalyzing(
    jobId,
    version
  );
  if (transitionToAnalyzingResult.isErr()) {
    return err({
      type: "state_transition_error",
      message: `Failed to transition to ANALYZING: ${transitionToAnalyzingResult.error.message}`,
      details: transitionToAnalyzingResult.error,
    });
  }

  // Step 2: Store scan results in a transaction
  const storeResultsResult = await wrapDbQuery(async () => {
    return await db.transaction(async (tx) => {
      // Insert scan result
      await tx.insert(scanResults).values({
        jobId,
        riskScore: containerResult.result.riskScore,
        categories: containerResult.result.categories,
        contentHash: containerResult.result.contentHash,
        httpStatus: containerResult.result.httpStatus,
        httpHeaders: containerResult.result.httpHeaders,
        contentType: containerResult.result.contentType,
        modelUsed: containerResult.result.modelUsed,
        analysisMetadata: containerResult.result.analysisMetadata || {},
        reasoning: containerResult.result.reasoning,
        indicators: containerResult.result.indicators,
      });

      return ok(undefined);
    });
  });

  if (storeResultsResult.isErr()) {
    return err({
      type: "database_error",
      message: `Failed to store scan results: ${storeResultsResult.error.message}`,
      details: storeResultsResult.error,
    });
  }

  // Step 3: Write audit log entry
  const auditLogger = new AuditLogger(new DatabaseAuditLogStorage());

  const auditEntry: Omit<AuditLogCreation, "contentHash" | "scanJobId"> = {
    urlAccessed,
    timestamp: new Date().toISOString(),
    httpStatus: containerResult.result.httpStatus,
    httpHeaders: containerResult.result.httpHeaders,
    contentType: containerResult.result.contentType,
    riskAssessmentSummary: {
      riskScore: containerResult.result.riskScore,
      categories: containerResult.result.categories,
      confidenceScore: containerResult.result.confidenceScore,
    },
  };

  const auditResult = await auditLogger.log(
    {
      ...auditEntry,
      scanJobId: jobId,
    },
    containerResult.result.contentHash
  );

  if (auditResult.isErr()) {
    // Log error but don't fail the job - audit logging is important but not critical
    console.error("[AUDIT LOG ERROR] Failed to write audit log:", {
      error: auditResult.error,
      errorType: auditResult.error.type,
      message: auditResult.error.message,
      cause: auditResult.error.cause,
      jobId,
      urlAccessed,
      contentHash: containerResult.result.contentHash,
    });

    // Also log the entry that failed to be inserted for debugging
    console.error("[AUDIT LOG ERROR] Entry that failed:", {
      scanJobId: jobId,
      urlAccessed,
      timestamp: auditEntry.timestamp,
      contentHash: containerResult.result.contentHash,
      httpStatus: auditEntry.httpStatus,
      contentType: auditEntry.contentType,
      riskAssessmentSummary: auditEntry.riskAssessmentSummary,
    });
  } else {
    console.log(
      "[AUDIT LOG SUCCESS] Audit log written successfully for job:",
      jobId
    );
  }

  // Step 4: Get updated version for final transition
  const updatedJobVersionResult = await getJobWithVersion(jobId);
  if (updatedJobVersionResult.isErr()) {
    return err({
      type: "state_transition_error",
      message: `Failed to get updated job version: ${updatedJobVersionResult.error.message}`,
      details: updatedJobVersionResult.error,
    });
  }

  const { version: updatedVersion } = updatedJobVersionResult.value;

  // Step 5: Transition ANALYZING -> COMPLETED
  const transitionToCompletedResult = await transitionToCompleted(
    jobId,
    updatedVersion
  );
  if (transitionToCompletedResult.isErr()) {
    return err({
      type: "state_transition_error",
      message: `Failed to transition to COMPLETED: ${transitionToCompletedResult.error.message}`,
      details: transitionToCompletedResult.error,
    });
  }

  return ok(undefined);
}
