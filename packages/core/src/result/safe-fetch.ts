import { ResultAsync } from "neverthrow";

// ============================================================================
// Error Types
// ============================================================================

/**
 * Network error - occurs when fetch fails due to network issues
 */
export interface NetworkError {
  type: "network";
  message: string;
  cause?: unknown;
}

/**
 * HTTP error - occurs when fetch succeeds but returns non-2xx status
 */
export interface HttpError<E = unknown> {
  type: "http";
  status: number;
  statusText: string;
  body: E | null;
  url: string;
}

/**
 * Parse error - occurs when JSON parsing fails
 */
export interface ParseError {
  type: "parse";
  message: string;
  cause?: unknown;
}

/**
 * Discriminated union of all fetch errors
 */
export type FetchError<E = unknown> = NetworkError | HttpError<E> | ParseError;

// ============================================================================
// Safe Fetch Implementation
// ============================================================================

/**
 * Fetch options type
 */
export interface SafeFetchOptions extends RequestInit {
  /**
   * Whether to parse JSON response automatically
   * @default true
   */
  parseJson?: boolean;
}

/**
 * Safely fetches a resource with discriminated error unions
 *
 * @param url - The URL to fetch
 * @param options - Fetch options (extends RequestInit)
 * @returns ResultAsync with the response data or a FetchError
 *
 * @example
 * ```typescript
 * const result = await safeFetch<{ data: string }>("https://api.example.com/data");
 * result.match(
 *   (data) => console.log("Success:", data),
 *   (error) => {
 *     if (error.type === "network") {
 *       console.error("Network error:", error.message);
 *     } else if (error.type === "http") {
 *       console.error("HTTP error:", error.status, error.statusText);
 *     } else {
 *       console.error("Parse error:", error.message);
 *     }
 *   }
 * );
 * ```
 */
export function safeFetch<T = unknown>(
  url: string | URL,
  options?: SafeFetchOptions,
): ResultAsync<T, FetchError> {
  const { parseJson = true, ...fetchOptions } = options || {};
  const urlString = typeof url === "string" ? url : url.toString();

  // Execute fetch and handle all error cases
  return ResultAsync.fromPromise(
    (async () => {
      try {
        // Step 1: Execute fetch
        const response = await fetch(url, fetchOptions);

        // Step 2: Check HTTP status
        if (!response.ok) {
          // Try to parse error body, but don't fail if parsing fails
          let errorBody: unknown = null;
          if (parseJson) {
            try {
              errorBody = await response.json();
            } catch {
              // Ignore parse errors for error responses
              errorBody = null;
            }
          }

          const httpError: HttpError = {
            type: "http",
            status: response.status,
            statusText: response.statusText,
            body: errorBody,
            url: urlString,
          };
          throw httpError;
        }

        // Step 3: Parse JSON if requested
        if (parseJson) {
          try {
            const data = await response.json();
            return data as T;
          } catch (error) {
            const parseError: ParseError = {
              type: "parse",
              message:
                error instanceof Error ? error.message : "JSON parsing failed",
              cause: error,
            };
            throw parseError;
          }
        }

        // If not parsing JSON, return response as-is (cast to T)
        return response as unknown as T;
      } catch (error) {
        // Re-throw if it's already a FetchError (HttpError or ParseError)
        if (
          typeof error === "object" &&
          error !== null &&
          "type" in error &&
          (error.type === "http" || error.type === "parse")
        ) {
          throw error;
        }

        // Otherwise, it's a network error
        const networkError: NetworkError = {
          type: "network",
          message:
            error instanceof Error ? error.message : "Network request failed",
          cause: error,
        };
        throw networkError;
      }
    })(),
    (error): FetchError => {
      // Error should already be a FetchError at this point
      if (
        typeof error === "object" &&
        error !== null &&
        "type" in error &&
        (error.type === "network" ||
          error.type === "http" ||
          error.type === "parse")
      ) {
        return error as FetchError;
      }

      // Fallback (shouldn't happen, but TypeScript needs it)
      return {
        type: "network",
        message:
          error instanceof Error ? error.message : "Network request failed",
        cause: error,
      };
    },
  );
}

/**
 * Type guard to check if an error is a NetworkError
 */
export function isNetworkError(error: FetchError): error is NetworkError {
  return error.type === "network";
}

/**
 * Type guard to check if an error is an HttpError
 */
export function isHttpError<E = unknown>(
  error: FetchError<E>,
): error is HttpError<E> {
  return error.type === "http";
}

/**
 * Type guard to check if an error is a ParseError
 */
export function isParseError(error: FetchError): error is ParseError {
  return error.type === "parse";
}
