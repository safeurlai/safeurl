// Shared utility functions
import { Result, ok, err } from "neverthrow";
import { contentHashSchema } from "../audit/schemas";

// ============================================================================
// Content Hash Utilities
// ============================================================================

/**
 * Generates SHA-256 hash of content
 * Re-exported from audit logger for convenience
 */
export {
  generateContentHash,
  generateContentHashFromStream,
} from "../audit/logger";

// ============================================================================
// URL Validation Helpers
// ============================================================================

/**
 * SSRF-safe URL validation
 * Validates that a URL is a public HTTP/HTTPS URL and not an internal/private IP
 *
 * @param url - URL string to validate
 * @returns Result with validated URL or error message
 *
 * @example
 * ```typescript
 * const result = validateSsrfSafeUrl("https://example.com");
 * result.match(
 *   (url) => console.log("Valid URL:", url),
 *   (error) => console.error("Invalid URL:", error)
 * );
 * ```
 */
export function validateSsrfSafeUrl(url: string): Result<string, string> {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Reject localhost variants
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      // 172.16.0.0/12 range
      (hostname.startsWith("172.") &&
        hostname.split(".").length >= 2 &&
        parseInt(hostname.split(".")[1] || "0") >= 16 &&
        parseInt(hostname.split(".")[1] || "0") <= 31)
    ) {
      return err("URL must be a public URL (no private/internal IPs)");
    }

    // Only allow http/https protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return err("URL must use HTTP or HTTPS protocol");
    }

    return ok(url);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Invalid URL format");
  }
}

/**
 * Normalizes a URL by removing fragments and sorting query parameters
 *
 * @param url - URL to normalize
 * @returns Normalized URL string
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove fragment
    parsed.hash = "";
    // Sort query parameters (optional - can be removed if order matters)
    // For now, we'll keep query params as-is
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Extracts the domain from a URL
 *
 * @param url - URL to extract domain from
 * @returns Domain string or null if invalid URL
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

// ============================================================================
// Error Formatters
// ============================================================================

/**
 * Formats Zod errors for API responses
 *
 * @param errors - ZodError object
 * @returns Formatted error object suitable for API responses
 */
export function formatZodErrors(errors: {
  issues: Array<{ path: (string | number)[]; message: string }>;
}): {
  code: string;
  message: string;
  details: Record<string, string[]>;
} {
  const details: Record<string, string[]> = {};

  for (const issue of errors.issues) {
    const path = issue.path.join(".");
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(issue.message);
  }

  return {
    code: "VALIDATION_ERROR",
    message: "Request validation failed",
    details,
  };
}

/**
 * Formats Result errors for API responses
 *
 * @param error - Error from a Result type
 * @returns Formatted error object suitable for API responses
 */
export function formatResultError(error: unknown): {
  code: string;
  message: string;
  details?: Record<string, unknown>;
} {
  if (typeof error === "object" && error !== null) {
    // Handle discriminated union errors
    if ("type" in error && typeof error.type === "string") {
      return {
        code: `${error.type?.toUpperCase()}_ERROR`,
        message:
          "message" in error ? String(error.message) : "An error occurred",
        details: error,
      };
    }
  }

  // Fallback for unknown error types
  return {
    code: "UNKNOWN_ERROR",
    message:
      error instanceof Error ? error.message : "An unknown error occurred",
    details: error instanceof Error ? { stack: error.stack } : { error },
  };
}

/**
 * Formats error messages for user-friendly display
 *
 * @param error - Error to format
 * @returns User-friendly error message
 */
export function formatUserFriendlyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
  }

  return "An unexpected error occurred";
}
