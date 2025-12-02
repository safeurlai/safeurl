/**
 * Database access for Cloudflare Workers API service
 *
 * All database access should use the @safeurl/db package directly.
 * Import db, schemas, and utilities from @safeurl/db:
 *
 * import { db, scanJobs, users, wallets } from "@safeurl/db";
 *
 * This ensures all services use the same Turso/libSQL database instance.
 *
 * For Cloudflare Workers, we use environment variables for Turso connection.
 * In the future, this will be migrated to Cloudflare D1.
 */
import { createDatabase, type DatabaseInstance } from "@safeurl/db";

/**
 * Create database instance from Cloudflare Workers environment
 * Uses TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN from env bindings
 */
export function createDatabaseFromEnv(env: Cloudflare.Env): DatabaseInstance {
  const url = env.TURSO_CONNECTION_URL as string;
  const authToken = env.TURSO_AUTH_TOKEN as string;

  if (!url) {
    throw new Error(
      "TURSO_CONNECTION_URL is required. " +
        "Set it in wrangler.jsonc vars or as a secret.",
    );
  }

  if (!authToken) {
    throw new Error(
      "TURSO_AUTH_TOKEN is required. " +
        "Set it as a secret using: wrangler secret put TURSO_AUTH_TOKEN",
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

export function getDatabase(env: Cloudflare.Env): DatabaseInstance {
  if (!dbInstance) {
    dbInstance = createDatabaseFromEnv(env);
  }
  return dbInstance;
}

export function getDb(env: Cloudflare.Env) {
  return getDatabase(env).db;
}
