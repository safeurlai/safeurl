import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { scanJobs } from "./scan-jobs";

/**
 * Audit Logs table
 * Immutable append-only log of all scan activities
 *
 * IMPORTANT: This table explicitly excludes:
 * - Content body
 * - Screenshots
 * - DOM snapshots
 *
 * Only metadata is stored for compliance and audit purposes.
 */
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    scanJobId: text("scan_job_id")
      .notNull()
      .references(() => scanJobs.id, { onDelete: "cascade" }),
    urlAccessed: text("url_accessed").notNull(),
    timestamp: integer("timestamp", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    contentHash: text("content_hash").notNull(), // SHA-256 hash
    httpStatus: integer("http_status"),
    httpHeaders: text("http_headers", { mode: "json" }).$type<
      Record<string, string>
    >(),
    contentType: text("content_type"),
    riskAssessmentSummary: text("risk_assessment_summary", {
      mode: "json",
    }).$type<Record<string, unknown>>(),
  },
  (table) => [
    // Index on scanJobId for job lookup
    index("audit_logs_scan_job_id_idx").on(table.scanJobId),
    // Index on timestamp for time-based queries
    index("audit_logs_timestamp_idx").on(table.timestamp),
    // Index on urlAccessed for URL-based lookups
    index("audit_logs_url_accessed_idx").on(table.urlAccessed),
    // Composite index for job lookup with timestamp (most recent first)
    index("audit_logs_scan_job_id_timestamp_idx").on(
      table.scanJobId,
      table.timestamp,
    ),
    // Index on contentHash for deduplication queries
    index("audit_logs_content_hash_idx").on(table.contentHash),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
