import { sqliteTable, text, integer, check, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { scanJobs } from "./scan-jobs";

/**
 * Scan Results table
 * Stores the analysis results from completed scans
 */
export const scanResults = sqliteTable(
  "scan_results",
  {
    jobId: text("job_id")
      .primaryKey()
      .notNull()
      .references(() => scanJobs.id, { onDelete: "cascade" }),
    riskScore: integer("risk_score").notNull(), // 0-100
    categories: text("categories", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    contentHash: text("content_hash").notNull(), // SHA-256 hash
    httpStatus: integer("http_status"),
    httpHeaders: text("http_headers", { mode: "json" }).$type<
      Record<string, string>
    >(),
    contentType: text("content_type"),
    modelUsed: text("model_used").notNull(),
    analysisMetadata: text("analysis_metadata", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
    reasoning: text("reasoning").notNull(),
    indicators: text("indicators", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => [
    // Check constraint: risk score must be between 0 and 100
    check(
      "risk_score_range",
      sql`${table.riskScore} >= 0 AND ${table.riskScore} <= 100`
    ),
    // Index on contentHash for deduplication queries (finding scans of same content)
    index("scan_results_content_hash_idx").on(
      table.contentHash
    ),
    // Index on createdAt for time-based queries
    index("scan_results_created_at_idx").on(table.createdAt),
    // Index on riskScore for filtering high-risk results
    index("scan_results_risk_score_idx").on(table.riskScore),
    // Composite index for querying high-risk results by time
    index("scan_results_risk_score_created_at_idx").on(
      table.riskScore,
      table.createdAt
    ),
  ]
);

export type ScanResult = typeof scanResults.$inferSelect;
export type NewScanResult = typeof scanResults.$inferInsert;

