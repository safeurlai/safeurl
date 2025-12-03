/**
 * Database access for Next.js API routes
 *
 * All database access should use the @safeurl/db package directly.
 * Import db, schemas, and utilities from @safeurl/db:
 *
 * import { db, apiKeys, users, wallets } from "@safeurl/db";
 *
 * This ensures all services use the same Turso/libSQL database instance.
 *
 * For Next.js, we use environment variables for Turso connection.
 */
import { createDatabase, type DatabaseInstance } from "@safeurl/db";

/**
 * Create database instance from Next.js environment
 * Uses TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN from environment variables
 */
export function createDatabaseFromEnv(): DatabaseInstance {
  const url = process.env.TURSO_CONNECTION_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      "TURSO_CONNECTION_URL is required. " +
        "Set it in your environment variables or .env file.",
    );
  }

  if (!authToken) {
    throw new Error(
      "TURSO_AUTH_TOKEN is required. " +
        "Set it in your environment variables or .env file.",
    );
  }

  return createDatabase({
    url,
    authToken,
  });
}

/**
 * Get database instance (lazy initialization)
 * Call this function to get the database instance in your handlers
 */
let dbInstance: DatabaseInstance | null = null;

export function getDatabase(): DatabaseInstance {
  if (!dbInstance) {
    dbInstance = createDatabaseFromEnv();
  }
  return dbInstance;
}

export function getDb() {
  return getDatabase().db;
}
