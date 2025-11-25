/**
 * Audit Logger Module
 * 
 * Creates audit log entries (metadata only, no content) and writes them.
 * For ephemeral containers, logs are written to stdout as JSON.
 */

import {
  AuditLogCreation,
  auditLogCreationSchema,
  validateMetadataOnly,
  Result,
  ok,
  err,
} from "@safeurl/core";

// ============================================================================
// Types
// ============================================================================

export interface AuditLogInput {
  scanJobId: string;
  urlAccessed: string;
  contentHash: string;
  httpStatus: number | null;
  httpHeaders: Record<string, string>;
  contentType: string | null;
  riskAssessmentSummary: {
    riskScore: number;
    categories: string[];
    confidenceScore: number;
  };
}

export interface AuditLogError {
  type: "validation" | "storage";
  message: string;
}

// ============================================================================
// Audit Log Creation
// ============================================================================

/**
 * Creates an audit log entry from input data
 * 
 * @param input - Audit log input data
 * @returns Result indicating success or failure
 */
export async function createAuditLog(
  input: AuditLogInput
): Promise<Result<void, AuditLogError>> {
  // Step 1: Validate that no content fields exist
  const metadataValidation = validateMetadataOnly(input);
  if (!metadataValidation.valid) {
    return err({
      type: "validation",
      message: `Metadata validation failed: ${metadataValidation.error}`,
    });
  }

  // Step 2: Create audit log entry
  const auditEntry: Omit<AuditLogCreation, "id"> = {
    scanJobId: input.scanJobId,
    urlAccessed: input.urlAccessed,
    timestamp: new Date().toISOString(),
    contentHash: input.contentHash,
    httpStatus: input.httpStatus,
    httpHeaders: input.httpHeaders,
    contentType: input.contentType,
    riskAssessmentSummary: input.riskAssessmentSummary,
  };

  // Step 3: Validate against schema
  const validation = auditLogCreationSchema.safeParse(auditEntry);
  if (!validation.success) {
    return err({
      type: "validation",
      message: `Schema validation failed: ${validation.error.message}`,
    });
  }

  // Step 4: Write audit log
  // For ephemeral containers, we write to stdout as JSON
  // The worker service will capture this and store it in the database
  try {
    const logOutput = {
      type: "audit_log",
      data: validation.data,
    };

    // Write to stderr to separate from result output (which goes to stdout)
    console.error(JSON.stringify(logOutput));

    return ok(undefined);
  } catch (error) {
    return err({
      type: "storage",
      message: `Failed to write audit log: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    });
  }
}

