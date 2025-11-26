/**
 * Database access for API service
 * 
 * All database access should use the @safeurl/db package directly.
 * Import db, schemas, and utilities from @safeurl/db:
 * 
 * import { db, scanJobs, users, wallets } from "@safeurl/db";
 * 
 * This ensures all services use the same Turso/libSQL database instance.
 */
import { createDatabase, type DatabaseInstance } from "@safeurl/db";

// Create database instance using environment variables
export const dbInstance = createDatabase({
  url: process.env.TURSO_CONNECTION_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export const db = dbInstance.db;
export const client = dbInstance.client;

export type { Database, DatabaseInstance } from "@safeurl/db";

