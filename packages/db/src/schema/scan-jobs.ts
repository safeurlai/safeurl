import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

/**
 * Scan job state enum
 * Matches the schema defined in @safeurl/core
 */
export const scanJobStateEnum = [
  "QUEUED",
  "FETCHING",
  "ANALYZING",
  "COMPLETED",
  "FAILED",
  "TIMED_OUT",
] as const;
export type ScanJobState = (typeof scanJobStateEnum)[number];

/**
 * Scan Jobs table
 * Tracks the lifecycle of URL scan jobs
 */
export const scanJobs = sqliteTable(
  "scan_jobs",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.clerkUserId, { onDelete: "cascade" }),
    url: text("url").notNull(),
    state: text("state", { enum: scanJobStateEnum })
      .notNull()
      .default("QUEUED"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`)
      .$onUpdate(() => new Date()),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    // Index on userId for user queries
    index("scan_jobs_user_id_idx").on(table.userId),
    // Index on state for worker queries (filtering QUEUED/FETCHING jobs)
    index("scan_jobs_state_idx").on(table.state),
    // Index on createdAt for time-based queries
    index("scan_jobs_created_at_idx").on(table.createdAt),
    // Composite index for user history queries (most recent first)
    // Note: SQLite doesn't support DESC in index definition, but query planner can use it
    index("scan_jobs_user_id_created_at_idx").on(table.userId, table.createdAt),
    // Index on url for deduplication queries and URL-based lookups
    index("scan_jobs_url_idx").on(table.url),
    // Composite index for worker queries: state + createdAt (for processing oldest jobs first)
    index("scan_jobs_state_created_at_idx").on(table.state, table.createdAt),
  ]
);

export type ScanJob = typeof scanJobs.$inferSelect;
export type NewScanJob = typeof scanJobs.$inferInsert;
