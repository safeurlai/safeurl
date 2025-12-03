// Shared TypeScript types
import type { Result } from "neverthrow";

// Re-export schema types
export type {
  // API types
  CreateScanRequest,
  GetScanRequest,
  PurchaseCreditsRequest,
  ScanResponse,
  ErrorResponse,
  CreditBalanceResponse,
  CreditPurchase,
  CreditTransaction,
} from "../schemas/api";

export type {
  // Scan types
  ScanJobState,
  ScanJobCreation,
  ScanResult,
  RiskCategory,
  StateTransition,
  ScanJob,
} from "../schemas/scan";

export type {
  // User types
  ClerkUserId,
  JwtPayload,
  ApiKey,
  ApiKeyValidation,
  WalletBalance,
  TransactionHistory,
  TransactionHistoryQuery,
  User,
} from "../schemas/user";

export type {
  // Audit types
  ContentHash,
  AuditLogEntry,
  AuditLogCreation,
} from "../audit/schemas";

// ============================================================================
// Result Type Helpers
// ============================================================================

/**
 * Extract the success type from a Result
 */
export type ResultSuccess<T> = T extends Result<infer S, unknown> ? S : never;

/**
 * Extract the error type from a Result
 */
export type ResultError<T> = T extends Result<unknown, infer E> ? E : never;

/**
 * Extract the success type from a ResultAsync
 */
export type ResultAsyncSuccess<T> =
  T extends Promise<Result<infer S, unknown>> ? S : never;

/**
 * Extract the error type from a ResultAsync
 */
export type ResultAsyncError<T> =
  T extends Promise<Result<unknown, infer E>> ? E : never;
