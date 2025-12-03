/**
 * Library utilities exports
 */

export { createDatabaseFromEnv, getDatabase, getDb } from "./db";

// Re-export DatabaseInstance type from @safeurl/db
export type { DatabaseInstance } from "@safeurl/db";

export {
  sendScanJobToQueue,
  sendScanJobsToQueue,
  type ScanJobMessage,
} from "./queue";

