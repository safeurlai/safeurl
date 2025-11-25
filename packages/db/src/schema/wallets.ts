import {
  sqliteTable,
  text,
  integer,
  index,
  check,
  unique,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

/**
 * Wallets table
 * Stores user credit balances (one wallet per user)
 */
export const wallets = sqliteTable(
  "wallets",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.clerkUserId, { onDelete: "cascade" }),
    creditBalance: integer("credit_balance").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`unixepoch()`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`unixepoch()`)
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Unique constraint: one wallet per user (enforced at database level)
    // Note: This also creates an index automatically in SQLite
    userIdUnique: unique("wallets_user_id_unique").on(table.userId),
    // Check constraint: credit balance must be non-negative
    creditBalanceCheck: check(
      "credit_balance_non_negative",
      sql`${table.creditBalance} >= 0`
    ),
  })
);

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
