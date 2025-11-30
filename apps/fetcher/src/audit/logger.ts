import {
  AuditLogCreation,
  auditLogCreationSchema,
  err,
  ok,
  Result,
  validateMetadataOnly,
} from "@safeurl/core";

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

export async function createAuditLog(
  input: AuditLogInput,
): Promise<Result<void, AuditLogError>> {
  const metadataValidation = validateMetadataOnly(input);
  if (!metadataValidation.valid) {
    return err({
      type: "validation",
      message: `Metadata validation failed: ${metadataValidation.error}`,
    });
  }

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

  const validation = auditLogCreationSchema.safeParse(auditEntry);
  if (!validation.success) {
    return err({
      type: "validation",
      message: `Schema validation failed: ${validation.error.message}`,
    });
  }

  try {
    const logOutput = {
      type: "audit_log",
      data: validation.data,
    };

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
