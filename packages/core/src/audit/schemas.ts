import { z } from "zod";

// ============================================================================
// Content Hash Validation
// ============================================================================

/**
 * SHA-256 hash validation schema
 * Validates that a string is a valid SHA-256 hash (64 hex characters)
 */
export const contentHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, "Content hash must be a valid SHA-256 hash (64 hex characters)")
  .describe("SHA-256 hash of the content");

// ============================================================================
// Audit Log Entry Schema
// ============================================================================

/**
 * Audit log entry schema
 * Represents a single audit log entry for compliance and tracking
 *
 * IMPORTANT: This schema explicitly excludes content fields:
 * - No content body
 * - No screenshots
 * - No DOM content
 * - Only metadata and hashes are stored
 */
export const auditLogEntrySchema = z.object({
  id: z.string().uuid().describe("Unique audit log entry ID"),
  scanJobId: z
    .string()
    .uuid()
    .describe("Foreign key to scan_jobs table"),
  urlAccessed: z
    .string()
    .url()
    .describe("URL that was accessed (indexed for queries)"),
  timestamp: z
    .string()
    .datetime()
    .describe("ISO 8601 timestamp of when the URL was accessed"),
  contentHash: contentHashSchema.describe("SHA-256 hash of the fetched content"),
  httpStatus: z
    .number()
    .int()
    .nullable()
    .describe("HTTP status code of the response (null if fetch failed)"),
  httpHeaders: z
    .record(z.string(), z.string())
    .describe("Sanitized HTTP response headers (no sensitive data)"),
  contentType: z
    .string()
    .nullable()
    .describe("Content-Type header value (MIME type only)"),
  riskAssessmentSummary: z
    .object({
      riskScore: z.number().int().min(0).max(100),
      categories: z.array(z.string()),
      confidenceScore: z.number().min(0).max(1),
    })
    .describe("Summary of the risk assessment (no detailed reasoning)"),
});

/**
 * Runtime validation helper to ensure no content fields exist
 * This is a safety check to prevent accidental content storage
 */
export function validateMetadataOnly(data: unknown): {
  valid: boolean;
  error?: string;
} {
  if (typeof data !== "object" || data === null) {
    return { valid: false, error: "Data must be an object" };
  }

  const forbiddenFields = [
    "content",
    "body",
    "html",
    "text",
    "screenshot",
    "screenshots",
    "dom",
    "domContent",
    "pageContent",
    "responseBody",
    "responseContent",
  ];

  const dataObj = data as Record<string, unknown>;
  for (const field of forbiddenFields) {
    if (field in dataObj) {
      return {
        valid: false,
        error: `Forbidden field '${field}' detected. Audit logs must not contain content fields.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Audit log entry creation schema
 * Used when creating a new audit log entry
 */
export const auditLogCreationSchema = auditLogEntrySchema.omit({ id: true }).refine(
  (data) => {
    const validation = validateMetadataOnly(data);
    return validation.valid;
  },
  {
    message: "Audit log must not contain content fields",
  }
);

// ============================================================================
// Type Exports
// ============================================================================

export type ContentHash = z.infer<typeof contentHashSchema>;
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;
export type AuditLogCreation = z.infer<typeof auditLogCreationSchema>;

