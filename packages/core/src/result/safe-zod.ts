import { z, ZodError } from "zod";
import { Result, ok, err } from "neverthrow";

// ============================================================================
// Error Types
// ============================================================================

/**
 * Zod parse error
 * Wraps ZodError for discriminated union pattern
 */
export interface ZodParseError<T = unknown> {
  type: "zod";
  errors: ZodError<T>;
}

// ============================================================================
// Safe Zod Parse Implementation
// ============================================================================

/**
 * Safely parses data using a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Result with parsed data or ZodParseError
 *
 * @example
 * ```typescript
 * const schema = z.object({ name: z.string(), age: z.number() });
 * const result = safeZodParse(schema, { name: "John", age: 30 });
 *
 * result.match(
 *   (data) => console.log("Valid:", data),
 *   (error) => {
 *     if (error.type === "zod") {
 *       console.error("Validation errors:", error.errors.format());
 *     }
 *   }
 * );
 * ```
 */
export function safeZodParse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): Result<z.infer<T>, ZodParseError<z.infer<T>>> {
  const result = schema.safeParse(data);

  if (result.success) {
    return ok(result.data);
  }

  return err({
    type: "zod",
    errors: result.error,
  });
}

/**
 * Type guard to check if an error is a ZodParseError
 */
export function isZodParseError<T = unknown>(
  error: unknown
): error is ZodParseError<T> {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "zod" &&
    "errors" in error &&
    error.errors instanceof ZodError
  );
}

