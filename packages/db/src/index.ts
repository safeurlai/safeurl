import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Create a database client instance
 * Uses libSQL (Turso) for local and remote database access
 */
export function createDatabase(options?: {
  url?: string;
  authToken?: string;
}): LibSQLDatabase<typeof schema> {
  const url = options?.url || process.env.DATABASE_URL || "file:./local.db";
  const authToken = options?.authToken || process.env.DATABASE_AUTH_TOKEN;

  const client = createClient({
    url,
    authToken,
  });

  return drizzle(client, { schema });
}

/**
 * Default database instance
 * Uses environment variables for configuration
 */
export const db = createDatabase();

// Export schema and types
export * from "./schema";
export type Database = LibSQLDatabase<typeof schema>;
