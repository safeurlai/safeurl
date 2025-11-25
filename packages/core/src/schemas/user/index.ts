import { z } from "zod";

// ============================================================================
// User Authentication Schemas
// ============================================================================

/**
 * Clerk user ID validation schema
 * Clerk user IDs are typically prefixed with "user_" and contain alphanumeric characters
 */
export const clerkUserIdSchema = z
  .string()
  .min(1, "User ID is required")
  .regex(/^user_[a-z0-9]+$/i, "Invalid Clerk user ID format")
  .describe("Clerk user ID (format: user_xxxxx)");

/**
 * JWT payload schema
 * Standard JWT claims plus Clerk-specific claims
 */
export const jwtPayloadSchema = z.object({
  sub: z.string().describe("Subject (user ID)"),
  iat: z.number().int().positive().optional().describe("Issued at timestamp"),
  exp: z.number().int().positive().optional().describe("Expiration timestamp"),
  nbf: z.number().int().positive().optional().describe("Not before timestamp"),
  iss: z.string().optional().describe("Issuer"),
  aud: z.union([z.string(), z.array(z.string())]).optional().describe("Audience"),
  jti: z.string().optional().describe("JWT ID"),
  // Clerk-specific claims
  org_id: z.string().optional().describe("Organization ID"),
  org_role: z.string().optional().describe("Organization role"),
  org_slug: z.string().optional().describe("Organization slug"),
  session_id: z.string().optional().describe("Session ID"),
});

// ============================================================================
// API Key Schemas
// ============================================================================

/**
 * API key creation schema
 * Used when creating a new API key
 */
export const apiKeyCreationSchema = z.object({
  name: z
    .string()
    .min(1, "API key name is required")
    .max(100, "API key name exceeds maximum length")
    .describe("Human-readable name for the API key"),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .describe("Optional expiration date (ISO 8601)"),
  scopes: z
    .array(z.enum(["scan:read", "scan:write", "credits:read"]))
    .min(1, "At least one scope is required")
    .describe("API key scopes/permissions"),
});

/**
 * API key validation schema
 * Used when validating an API key
 */
export const apiKeySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  keyHash: z
    .string()
    .min(1)
    .describe("Hashed API key (never store plaintext keys)"),
  name: z.string().min(1),
  scopes: z.array(z.string()),
  expiresAt: z.string().datetime().nullable(),
  lastUsedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
});

/**
 * API key validation request schema
 * Used when validating an API key from a request
 */
export const apiKeyValidationSchema = z.object({
  key: z.string().min(1, "API key is required"),
});

// ============================================================================
// Credit Wallet Schemas
// ============================================================================

/**
 * Wallet balance schema
 * Represents a user's credit wallet balance
 */
export const walletBalanceSchema = z.object({
  userId: z.string().min(1),
  creditBalance: z
    .number()
    .int()
    .min(0, "Credit balance cannot be negative")
    .describe("Current credit balance"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Transaction history schema
 * Represents a single credit transaction
 */
export const transactionHistorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  amount: z
    .number()
    .int()
    .describe("Transaction amount (positive for credits added, negative for credits used)"),
  type: z.enum(["purchase", "scan", "refund", "adjustment"]),
  scanJobId: z.string().uuid().nullable().optional(),
  purchaseId: z.string().uuid().nullable().optional(),
  description: z.string().optional(),
  balanceAfter: z
    .number()
    .int()
    .min(0)
    .describe("Credit balance after this transaction"),
  createdAt: z.string().datetime(),
});

/**
 * Transaction history query schema
 * Used for querying transaction history
 */
export const transactionHistoryQuerySchema = z.object({
  userId: z.string().min(1),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().min(0).default(0),
  type: z.enum(["purchase", "scan", "refund", "adjustment"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ============================================================================
// User Schema
// ============================================================================

/**
 * User schema
 * Represents a user in the system
 */
export const userSchema = z.object({
  clerkUserId: clerkUserIdSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ClerkUserId = z.infer<typeof clerkUserIdSchema>;
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
export type ApiKeyCreation = z.infer<typeof apiKeyCreationSchema>;
export type ApiKey = z.infer<typeof apiKeySchema>;
export type ApiKeyValidation = z.infer<typeof apiKeyValidationSchema>;
export type WalletBalance = z.infer<typeof walletBalanceSchema>;
export type TransactionHistory = z.infer<typeof transactionHistorySchema>;
export type TransactionHistoryQuery = z.infer<typeof transactionHistoryQuerySchema>;
export type User = z.infer<typeof userSchema>;
