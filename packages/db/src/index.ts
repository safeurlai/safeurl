import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { sql, type SQL } from "drizzle-orm";
import * as schema from "./schema";

let dbClient: Client | null = null;

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

  dbClient = createClient({
    url,
    authToken,
  });

  return drizzle(dbClient, { schema });
}

/**
 * Default database instance
 * Uses environment variables for configuration
 */
export const db = createDatabase();

/**
 * Execute raw SQL query using the underlying libsql client
 * This is a type-safe wrapper for executing raw SQL when needed
 * 
 * @param query - Drizzle SQL template literal
 */
export async function executeRawSQL(query: SQL): Promise<void> {
  if (!dbClient) {
    throw new Error("Database client not initialized");
  }
  
  // Convert drizzle SQL template to libsql format
  // Drizzle's SQL object has queryChunks and params properties
  const sqlString = query.queryChunks.join("?");
  const args = query.params as unknown[];
  
  await dbClient.execute({
    sql: sqlString,
    args,
  });
}

// Export schema and types
export * from "./schema";
export type Database = LibSQLDatabase<typeof schema>;
