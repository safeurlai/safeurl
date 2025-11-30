import { z } from "zod";

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * POST /v1/scans request validation schema
 * Validates URL scan creation requests
 */
export const createScanRequestSchema = z.object({
  url: z
    .string()
    .url("Invalid URL format")
    .min(1, "URL is required")
    .max(2048, "URL exceeds maximum length")
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          // SSRF protection: reject private/internal IPs and localhost
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
            hostname.startsWith("172.16.") ||
            hostname.startsWith("172.17.") ||
            hostname.startsWith("172.18.") ||
            hostname.startsWith("172.19.") ||
            hostname.startsWith("172.20.") ||
            hostname.startsWith("172.21.") ||
            hostname.startsWith("172.22.") ||
            hostname.startsWith("172.23.") ||
            hostname.startsWith("172.24.") ||
            hostname.startsWith("172.25.") ||
            hostname.startsWith("172.26.") ||
            hostname.startsWith("172.27.") ||
            hostname.startsWith("172.28.") ||
            hostname.startsWith("172.29.") ||
            hostname.startsWith("172.30.") ||
            hostname.startsWith("172.31.")
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
    ),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Optional metadata to associate with the scan"),
});

/**
 * GET /v1/scans/:id request validation schema
 * Validates scan ID parameter
 */
export const getScanRequestSchema = z.object({
  id: z.string().uuid("Invalid scan job ID format"),
});

/**
 * Credit purchase request validation schema
 */
export const purchaseCreditsRequestSchema = z.object({
  amount: z
    .number()
    .int("Credit amount must be an integer")
    .positive("Credit amount must be positive")
    .max(1000000, "Credit amount exceeds maximum"),
  paymentMethod: z
    .enum(["crypto", "stripe"])
    .describe("Payment method for credit purchase"),
  paymentDetails: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Payment method-specific details"),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Create scan job response schema
 * Returned when creating a new scan job
 */
export const createScanResponseSchema = z.object({
  id: z.string().uuid().describe("Scan job ID"),
  state: z.enum(["QUEUED"]).describe("Initial state of the scan job"),
});

/**
 * Scan result response schema
 * Returned when retrieving scan results
 */
export const scanResponseSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  state: z.enum([
    "QUEUED",
    "FETCHING",
    "ANALYZING",
    "COMPLETED",
    "FAILED",
    "TIMED_OUT",
  ]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  result: z
    .object({
      riskScore: z.number().int().min(0).max(100),
      categories: z.array(z.string()),
      confidenceScore: z.number().min(0).max(1),
      reasoning: z.string(),
      indicators: z.array(z.string()),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
      httpStatus: z.number().int().nullable(),
      httpHeaders: z.record(z.string(), z.string()),
      contentType: z.string().nullable(),
      modelUsed: z.string(),
      analysisMetadata: z.record(z.string(), z.unknown()).optional(),
    })
    .nullable()
    .describe("Scan result (null if scan not completed)"),
});

/**
 * Standardized error response schema
 */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string().describe("Machine-readable error code"),
    message: z.string().describe("Human-readable error message"),
    details: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Additional error details"),
  }),
  timestamp: z.string().datetime(),
  requestId: z.string().uuid().optional(),
});

/**
 * Credit balance response schema
 */
export const creditBalanceResponseSchema = z.object({
  balance: z.number().int().min(0).describe("Current credit balance"),
  userId: z.string().describe("User ID"),
  updatedAt: z.string().datetime(),
});

// ============================================================================
// Credit Management Schemas
// ============================================================================

/**
 * Credit purchase schema
 */
export const creditPurchaseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  amount: z.number().int().positive(),
  paymentMethod: z.enum(["crypto", "stripe"]),
  paymentDetails: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["pending", "completed", "failed"]),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

/**
 * Credit transaction schema
 */
export const creditTransactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  amount: z
    .number()
    .int()
    .describe("Positive for credits added, negative for credits used"),
  type: z.enum(["purchase", "scan", "refund", "adjustment"]),
  scanJobId: z.string().uuid().nullable().optional(),
  purchaseId: z.string().uuid().nullable().optional(),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
});

/**
 * Purchase credits response schema
 * Response returned when purchasing credits
 */
export const purchaseCreditsResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  amount: z.number().int().positive(),
  paymentMethod: z.enum(["crypto", "stripe"]),
  status: z.string(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  newBalance: z.number().int().min(0),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateScanRequest = z.infer<typeof createScanRequestSchema>;
export type GetScanRequest = z.infer<typeof getScanRequestSchema>;
export type PurchaseCreditsRequest = z.infer<
  typeof purchaseCreditsRequestSchema
>;
export type CreateScanResponse = z.infer<typeof createScanResponseSchema>;
export type ScanResponse = z.infer<typeof scanResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type CreditBalanceResponse = z.infer<typeof creditBalanceResponseSchema>;
export type CreditPurchase = z.infer<typeof creditPurchaseSchema>;
export type CreditTransaction = z.infer<typeof creditTransactionSchema>;
export type PurchaseCreditsResponse = z.infer<
  typeof purchaseCreditsResponseSchema
>;
