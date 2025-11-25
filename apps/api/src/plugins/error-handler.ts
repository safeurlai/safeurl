import { Elysia } from "elysia";
import { Result } from "@safeurl/core/result";

/**
 * Error response format
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  requestId?: string;
}

/**
 * Maps error types to HTTP status codes
 */
function getStatusCode(error: unknown): number {
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    
    // Handle Result type errors
    if (code.includes("validation")) return 400;
    if (code.includes("not_found")) return 404;
    if (code.includes("payment") || code.includes("insufficient_credits")) return 402;
  }
  
  return 500;
}

/**
 * Extracts error code from error
 */
function getErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String(error.code);
  }
  return "internal_server_error";
}

/**
 * Extracts error message from error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "An unexpected error occurred";
}

/**
 * Formats error response
 */
function formatErrorResponse(
  error: unknown,
  requestId?: string
): ErrorResponse {
  return {
    error: {
      code: getErrorCode(error),
      message: getErrorMessage(error),
      details: error && typeof error === "object" && "details" in error
        ? error.details
        : undefined,
    },
    timestamp: new Date().toISOString(),
    requestId,
  };
}

/**
 * Error handler plugin for ElysiaJS
 * Handles errors and converts Result types to HTTP responses
 */
export const errorHandlerPlugin = new Elysia()
  .onError(({ code, error, set, request }) => {
    // Generate request ID if not present
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID();

    // Handle Result type errors
    if (error && typeof error === "object" && "error" in error) {
      const resultError = error as { error: unknown };
      const statusCode = getStatusCode(resultError.error);
      set.status = statusCode;
      return formatErrorResponse(resultError.error, requestId);
    }

    // Handle validation errors (ElysiaJS built-in)
    if (code === "VALIDATION") {
      set.status = 400;
      return formatErrorResponse(
        {
          code: "validation_error",
          message: "Request validation failed",
          details: error,
        },
        requestId
      );
    }

    // Handle not found errors
    if (code === "NOT_FOUND") {
      set.status = 404;
      return formatErrorResponse(
        {
          code: "not_found",
          message: "Resource not found",
        },
        requestId
      );
    }


    // Default error handling
    const statusCode = getStatusCode(error);
    set.status = statusCode;
    
    // Don't expose internal errors in production
    const isDevelopment = process.env.NODE_ENV === "development";
    const message = isDevelopment
      ? getErrorMessage(error)
      : "An internal server error occurred";

    return formatErrorResponse(
      {
        code: getErrorCode(error),
        message,
        details: isDevelopment ? error : undefined,
      },
      requestId
    );
  })
  .onAfterHandle(({ set, request }) => {
    // Add request ID to response headers
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
    set.headers["x-request-id"] = requestId;
  });

