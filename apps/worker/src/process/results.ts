import { Result, ok, err } from "@safeurl/core/result";
import { wrapDbQuery } from "@safeurl/core/result";
import { db, scanResults, auditLogs } from "@safeurl/db";
import { AuditLogger } from "@safeurl/core/audit";
import type { ScanResult } from "@safeurl/core/schemas";
import type { AuditLogCreation } from "@safeurl/core/audit";
import { transitionToAnalyzing, transitionToCompleted, getJobWithVersion } from "../state/transitions";
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
  async append(entry: AuditLogCreation): Promise<Result<void, { type: string; message: string; cause?: unknown }>> {
    return wrapDbQuery(async () => {
      await db.insert(auditLogs).values({
        scanJobId: entry.scanJobId,
        urlAccessed: entry.urlAccessed,
        timestamp: new Date(entry.timestamp),
        contentHash: entry.contentHash,
        httpStatus: entry.httpStatus,
        httpHeaders: entry.httpHeaders,
        contentType: entry.contentType,
        riskAssessmentSummary: entry.riskAssessmentSummary,
      });
    }).mapErr((error) => ({
      type: "storage",
      message: error.message,
      cause: error,
    }));
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
  const transitionToAnalyzingResult = await transitionToAnalyzing(jobId, version);
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
    console.error("Failed to write audit log:", auditResult.error);
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
  const transitionToCompletedResult = await transitionToCompleted(jobId, updatedVersion);
  if (transitionToCompletedResult.isErr()) {
    return err({
      type: "state_transition_error",
      message: `Failed to transition to COMPLETED: ${transitionToCompletedResult.error.message}`,
      details: transitionToCompletedResult.error,
    });
  }

  return ok(undefined);
}

