// Export all schema tables
export * from "./users";
export * from "./wallets";
export * from "./scan-jobs";
export * from "./scan-results";
export * from "./audit-logs";

// Re-export types for convenience
export type {
  User,
  NewUser,
} from "./users";
export type {
  Wallet,
  NewWallet,
} from "./wallets";
export type {
  ScanJob,
  NewScanJob,
  ScanJobState,
} from "./scan-jobs";
export type {
  ScanResult,
  NewScanResult,
} from "./scan-results";
export type {
  AuditLog,
  NewAuditLog,
} from "./audit-logs";
