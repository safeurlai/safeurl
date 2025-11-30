import { z } from "zod";

// ============================================================================
// Scan Job State Enum
// ============================================================================

/**
 * Scan job state enum
 * Represents the current state of a scan job in the workflow
 */
export const scanJobStateSchema = z.enum([
  "QUEUED",
  "FETCHING",
  "ANALYZING",
  "COMPLETED",
  "FAILED",
  "TIMED_OUT",
]);

// ============================================================================
// Scan Job Creation Schema
// ============================================================================

/**
 * SSRF-safe URL validation helper
 * Validates that URLs are public HTTP/HTTPS URLs and not internal/private IPs
 */
const ssrfSafeUrlSchema = z
  .string()
  .url("Invalid URL format")
  .min(1, "URL is required")
  .max(2048, "URL exceeds maximum length")
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();

        // Reject localhost variants
        if (
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "0.0.0.0" ||
          hostname === "::1" ||
          hostname.startsWith("127.") ||
          hostname.startsWith("192.168.") ||
          hostname.startsWith("10.") ||
          // 172.16.0.0/12 range
          (hostname.startsWith("172.") &&
            hostname.split(".").length >= 2 &&
            parseInt(hostname.split(".")[1] || "0") >= 16 &&
            parseInt(hostname.split(".")[1] || "0") <= 31)
        ) {
          return false;
        }

        // Only allow http/https protocols
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    {
      message:
        "URL must be a valid public HTTP/HTTPS URL (no private/internal IPs)",
    },
  );

/**
 * Scan job creation schema
 * Used when creating a new scan job
 */
export const scanJobCreationSchema = z.object({
  url: ssrfSafeUrlSchema,
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Optional metadata to associate with the scan"),
});

// ============================================================================
// Scan Result Schema
// ============================================================================

/**
 * Risk category enum
 * Categories of risks that can be detected
 */
export const riskCategorySchema = z.enum([
  "malware",
  "phishing",
  "scam",
  "suspicious",
  "adult_content",
  "violence",
  "illegal_content",
  "misinformation",
  "spam",
  "other",
]);

/**
 * Scan result schema
 * Contains the analysis results from a completed scan
 */
export const scanResultSchema = z.object({
  riskScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Risk score from 0 (safe) to 100 (high risk)"),
  categories: z
    .array(riskCategorySchema)
    .min(0)
    .describe("Array of detected risk categories"),
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score from 0 to 1"),
  reasoning: z
    .string()
    .min(1)
    .describe("Human-readable explanation of the risk assessment"),
  indicators: z
    .array(z.string())
    .min(0)
    .describe(
      "Array of specific indicators that contributed to the assessment",
    ),
  contentHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "Content hash must be a valid SHA-256 hash")
    .describe("SHA-256 hash of the fetched content"),
  httpStatus: z
    .number()
    .int()
    .nullable()
    .describe("HTTP status code of the response (null if fetch failed)"),
  httpHeaders: z
    .record(z.string(), z.string())
    .describe("Sanitized HTTP response headers"),
  contentType: z
    .string()
    .nullable()
    .describe("Content-Type header value (MIME type)"),
  modelUsed: z
    .string()
    .min(1)
    .describe("Identifier of the LLM model used for analysis"),
  analysisMetadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Additional metadata from the analysis"),
});

// ============================================================================
// State Transition Validation Schemas
// ============================================================================

/**
 * Valid state transitions map
 * Defines which state transitions are allowed
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  QUEUED: ["FETCHING", "FAILED"],
  FETCHING: ["ANALYZING", "FAILED", "TIMED_OUT"],
  ANALYZING: ["COMPLETED", "FAILED", "TIMED_OUT"],
  COMPLETED: [], // Terminal state
  FAILED: [], // Terminal state
  TIMED_OUT: [], // Terminal state
};

/**
 * State transition schema
 * Validates state transitions with optimistic concurrency control
 */
export const stateTransitionSchema = z.object({
  fromState: scanJobStateSchema,
  toState: scanJobStateSchema,
  version: z
    .number()
    .int()
    .positive()
    .describe("Current version number for optimistic concurrency control"),
});

/**
 * Validates that a state transition is allowed
 */
export function validateStateTransition(
  from: string,
  to: string,
): { valid: boolean; error?: string } {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) {
    return { valid: false, error: `Invalid source state: ${from}` };
  }
  if (!allowed.includes(to)) {
    return {
      valid: false,
      error: `Invalid transition from ${from} to ${to}. Allowed transitions: ${allowed.join(", ")}`,
    };
  }
  return { valid: true };
}

/**
 * State transition validation schema with runtime validation
 */
export const validatedStateTransitionSchema = stateTransitionSchema.refine(
  (data) => {
    const validation = validateStateTransition(data.fromState, data.toState);
    return validation.valid;
  },
  {
    message: "Invalid state transition",
    path: ["toState"],
  },
);

// ============================================================================
// Complete Scan Job Schema
// ============================================================================

/**
 * Complete scan job schema
 * Represents a scan job with all its fields
 */
export const scanJobSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  url: ssrfSafeUrlSchema,
  state: scanJobStateSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
  result: scanResultSchema.nullable().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ScanJobState = z.infer<typeof scanJobStateSchema>;
export type ScanJobCreation = z.infer<typeof scanJobCreationSchema>;
export type ScanResult = z.infer<typeof scanResultSchema>;
export type RiskCategory = z.infer<typeof riskCategorySchema>;
export type StateTransition = z.infer<typeof stateTransitionSchema>;
export type ScanJob = z.infer<typeof scanJobSchema>;
