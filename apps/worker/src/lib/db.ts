import { createDatabase, type Database } from "@safeurl/db";

/**
 * Database instance for the worker service
 * Uses the shared database client from @safeurl/db
 */
export const db: Database = createDatabase();

