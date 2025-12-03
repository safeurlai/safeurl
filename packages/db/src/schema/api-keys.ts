import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { users } from "./users";

/**
 * API Keys table
 * Stores API keys for programmatic access to the API
 * Keys are hashed using SHA-256 and never stored in plaintext
 */
export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.clerkUserId, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull(),
    name: text("name").notNull(),
    scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Unique constraint on keyHash to prevent duplicate keys
    unique("api_keys_key_hash_unique").on(table.keyHash),
    // Index on userId for fast lookups of user's keys
    index("api_keys_user_id_idx").on(table.userId),
    // Index on revokedAt for filtering active keys
    index("api_keys_revoked_at_idx").on(table.revokedAt),
    // Composite index for active key lookups (userId + revokedAt)
    index("api_keys_user_id_revoked_at_idx").on(table.userId, table.revokedAt),
  ],
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
