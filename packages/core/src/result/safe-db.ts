import { ResultAsync } from "neverthrow";

// ============================================================================
// Database Error Types
// ============================================================================

/**
 * Database connection error
 * Occurs when unable to connect to the database
 */
export interface DatabaseConnectionError {
  type: "connection";
  message: string;
  cause?: unknown;
}

/**
 * Database query execution error
 * Occurs when a query fails to execute
 */
export interface DatabaseQueryError {
  type: "query";
  message: string;
  cause?: unknown;
}

/**
 * Database constraint violation error
 * Occurs when a constraint (unique, foreign key, etc.) is violated
 */
export interface DatabaseConstraintError {
  type: "constraint";
  message: string;
  constraint?: string;
  cause?: unknown;
}

/**
 * Discriminated union of all database errors
 */
export type DatabaseError =
  | DatabaseConnectionError
  | DatabaseQueryError
  | DatabaseConstraintError;

// ============================================================================
// Database Operation Wrappers
// ============================================================================

/**
 * Wraps a database query in a Result type
 *
 * @param queryFn - Function that returns a promise with the query result
 * @returns ResultAsync with query result or DatabaseError
 *
 * @example
 * ```typescript
 * const result = await wrapDbQuery(() => db.select().from(users));
 * result.match(
 *   (data) => console.log("Users:", data),
 *   (error) => {
 *     if (error.type === "connection") {
 *       console.error("Connection error:", error.message);
 *     } else if (error.type === "query") {
 *       console.error("Query error:", error.message);
 *     } else {
 *       console.error("Constraint error:", error.message);
 *     }
 *   }
 * );
 * ```
 */
export function wrapDbQuery<T>(
  queryFn: () => Promise<T>,
): ResultAsync<T, DatabaseError> {
  return ResultAsync.fromPromise(queryFn(), (error): DatabaseError => {
    // Try to extract more specific error information
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Check for connection errors
      if (
        message.includes("connection") ||
        message.includes("connect") ||
        message.includes("timeout") ||
        message.includes("network")
      ) {
        return {
          type: "connection",
          message: error.message,
          cause: error,
        };
      }

      // Check for constraint violations
      if (
        message.includes("constraint") ||
        message.includes("unique") ||
        message.includes("foreign key") ||
        message.includes("duplicate")
      ) {
        return {
          type: "constraint",
          message: error.message,
          constraint: extractConstraintName(error.message),
          cause: error,
        };
      }
    }

    // Default to query error
    return {
      type: "query",
      message: error instanceof Error ? error.message : "Database query failed",
      cause: error,
    };
  });
}

/**
 * Wraps a database transaction in a Result type
 *
 * @param transactionFn - Function that executes database operations within a transaction
 * @returns ResultAsync with transaction result or DatabaseError
 *
 * @example
 * ```typescript
 * const result = await wrapDbTransaction(async (tx) => {
 *   await tx.insert(users).values({ name: "John" });
 *   await tx.insert(wallets).values({ userId: "user_123", balance: 100 });
 *   return { success: true };
 * });
 * ```
 */
export function wrapDbTransaction<T>(
  transactionFn: (tx: unknown) => Promise<T>,
): ResultAsync<T, DatabaseError> {
  return wrapDbQuery(() => transactionFn({} as unknown));
}

/**
 * Extracts constraint name from error message (helper function)
 */
function extractConstraintName(message: string): string | undefined {
  // Try to extract constraint name from common error message patterns
  const uniqueMatch = message.match(/unique constraint ["']?(\w+)["']?/i);
  if (uniqueMatch) return uniqueMatch[1];

  const fkMatch = message.match(/foreign key constraint ["']?(\w+)["']?/i);
  if (fkMatch) return fkMatch[1];

  const constraintMatch = message.match(/constraint ["']?(\w+)["']?/i);
  if (constraintMatch) return constraintMatch[1];

  return undefined;
}

/**
 * Type guard to check if an error is a DatabaseConnectionError
 */
export function isDatabaseConnectionError(
  error: DatabaseError,
): error is DatabaseConnectionError {
  return error.type === "connection";
}

/**
 * Type guard to check if an error is a DatabaseQueryError
 */
export function isDatabaseQueryError(
  error: DatabaseError,
): error is DatabaseQueryError {
  return error.type === "query";
}

/**
 * Type guard to check if an error is a DatabaseConstraintError
 */
export function isDatabaseConstraintError(
  error: DatabaseError,
): error is DatabaseConstraintError {
  return error.type === "constraint";
}
