/**
 * Database access for Cloudflare Worker
 *
 * Uses Turso with @libsql/client/web for HTTP mode (compatible with Workers)
 * For D1 migration in the future, replace with D1 bindings
 */
import { createClient, type Client } from "@libsql/client";
import * as schema from "@safeurl/db";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

/**
 * Database instance with client
 */
export interface DatabaseInstance {
  db: LibSQLDatabase<typeof schema>;
  client: Client;
}

/**
 * Create a database client instance for Cloudflare Workers
 * Uses libSQL (Turso) with HTTP mode for Workers compatibility
 *
 * @param env - Worker environment with database credentials
 * @returns Database instance with both drizzle db and underlying client
 */
export function createDatabase(env: {
  TURSO_CONNECTION_URL: string;
  TURSO_AUTH_TOKEN: string;
}): DatabaseInstance {
  // Use HTTP mode for Cloudflare Workers compatibility
  const client = createClient({
    url: env.TURSO_CONNECTION_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client, { schema });

  return { db, client };
}

export type Database = LibSQLDatabase<typeof schema>;
