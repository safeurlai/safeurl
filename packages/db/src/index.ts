import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { sql, type SQL } from "drizzle-orm";
import * as schema from "./schema";

/**
 * Database instance with client
 */
export interface DatabaseInstance {
  db: LibSQLDatabase<typeof schema>;
  client: Client;
}

/**
 * Create a database client instance
 * Uses libSQL (Turso) for local and remote database access
 * 
 * Consumers must explicitly pass the Turso URL and token, or set TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN environment variables.
 * 
 * @param options - Database connection options
 * @param options.url - Turso connection URL (or use TURSO_CONNECTION_URL env var)
 * @param options.authToken - Turso authentication token (or use TURSO_AUTH_TOKEN env var)
 * @returns Database instance with both drizzle db and underlying client
 */
export function createDatabase(options?: {
  url?: string;
  authToken?: string;
}): DatabaseInstance {
  const url = options?.url || process.env.TURSO_CONNECTION_URL;
  const authToken = options?.authToken || process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      "TURSO_CONNECTION_URL is required. " +
      "Either provide url option to createDatabase() or set TURSO_CONNECTION_URL environment variable."
    );
  }

  if (!authToken) {
    throw new Error(
      "TURSO_AUTH_TOKEN is required. " +
      "Either provide authToken option to createDatabase() or set TURSO_AUTH_TOKEN environment variable."
    );
  }

  const client = createClient({
    url,
    authToken,
  });

  const db = drizzle(client, { schema });

  return { db, client };
}

/**
 * Execute raw SQL query using the underlying libsql client
 * This is a type-safe wrapper for executing raw SQL when needed
 * 
 * @param instance - Database instance from createDatabase()
 * @param query - Drizzle SQL template literal
 */
export async function executeRawSQL(
  instance: DatabaseInstance | LibSQLDatabase<typeof schema>,
  query: SQL
): Promise<void> {
  const client = getClient(instance);
  
  // Convert drizzle SQL template to libsql format
  // Drizzle's SQL object has queryChunks and params properties
  const sqlString = query.queryChunks.join("?");
  const args = query.params as unknown[];
  
  await client.execute({
    sql: sqlString,
    args,
  });
}

/**
 * Execute raw SQL string directly
 * Useful for running migration files or DDL statements
 * 
 * @param instance - Database instance from createDatabase()
 * @param sqlString - Raw SQL string to execute
 */
export async function executeRawSQLString(
  instance: DatabaseInstance | LibSQLDatabase<typeof schema>,
  sqlString: string
): Promise<void> {
  const client = getClient(instance);
  
  await client.execute({
    sql: sqlString,
    args: [],
  });
}

/**
 * Get the underlying libsql client from a database instance
 */
function getClient(instance: DatabaseInstance | LibSQLDatabase<typeof schema>): Client {
  // If it's a DatabaseInstance object with both db and client
  if (instance && typeof instance === 'object' && 'client' in instance) {
    return (instance as DatabaseInstance).client;
  }
  
  // Otherwise, try to extract from drizzle instance (fallback for backward compatibility)
  const client = (instance as any).client as Client;
  if (!client) {
    throw new Error(
      "Database client not available. " +
      "Make sure to use createDatabase() which returns { db, client }, " +
      "or pass the DatabaseInstance object to executeRawSQL/executeRawSQLString."
    );
  }
  return client;
}

// Export schema and types
export * from "./schema";
export type Database = LibSQLDatabase<typeof schema>;
export type { DatabaseInstance };
