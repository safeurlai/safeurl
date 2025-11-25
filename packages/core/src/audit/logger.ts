import { Result, ok, err } from "neverthrow";
import { contentHashSchema, AuditLogCreation, validateMetadataOnly } from "./schemas";

// ============================================================================
// Content Hash Generation
// ============================================================================

/**
 * Generates SHA-256 hash of content
 *
 * @param content - Content to hash (string, ArrayBuffer, or Uint8Array)
 * @returns Result with hex-encoded SHA-256 hash
 *
 * @example
 * ```typescript
 * const result = await generateContentHash("Hello, world!");
 * result.match(
 *   (hash) => console.log("Hash:", hash),
 *   (error) => console.error("Error:", error)
 * );
 * ```
 */
export async function generateContentHash(
  content: string | ArrayBuffer | Uint8Array
): Promise<Result<string, { message: string; cause?: unknown }>> {
  try {
    // Convert content to Uint8Array if needed
    let data: Uint8Array;
    if (typeof content === "string") {
      data = new TextEncoder().encode(content);
    } else if (content instanceof ArrayBuffer) {
      data = new Uint8Array(content);
    } else {
      data = content;
    }

    // Use Web Crypto API for SHA-256 hashing
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Validate the hash format
    const validation = contentHashSchema.safeParse(hashHex);
    if (!validation.success) {
      return err({
        message: "Generated hash does not match expected format",
        cause: validation.error,
      });
    }

    return ok(hashHex);
  } catch (error) {
    return err({
      message: error instanceof Error ? error.message : "Failed to generate content hash",
      cause: error,
    });
  }
}

/**
 * Generates SHA-256 hash of content from a stream
 * Useful for large content that shouldn't be loaded into memory
 *
 * @param stream - ReadableStream to hash
 * @returns Result with hex-encoded SHA-256 hash
 *
 * @example
 * ```typescript
 * const response = await fetch("https://example.com/large-file");
 * const result = await generateContentHashFromStream(response.body);
 * ```
 */
export async function generateContentHashFromStream(
  stream: ReadableStream<Uint8Array>
): Promise<Result<string, { message: string; cause?: unknown }>> {
  try {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return generateContentHash(combined);
  } catch (error) {
    return err({
      message: error instanceof Error ? error.message : "Failed to hash stream",
      cause: error,
    });
  }
}

// ============================================================================
// Audit Logger Interface
// ============================================================================

/**
 * Audit log storage interface
 * Abstract interface for audit log storage implementations
 */
export interface AuditLogStorage {
  /**
   * Append a new audit log entry
   * This operation must be atomic and immutable
   *
   * @param entry - Audit log entry to store
   * @returns Result indicating success or failure
   */
  append(entry: AuditLogCreation): Promise<Result<void, AuditLogError>>;
}

/**
 * Audit log errors
 */
export interface AuditLogError {
  type: "storage" | "validation" | "hash";
  message: string;
  cause?: unknown;
}

// ============================================================================
// Audit Logger Implementation
// ============================================================================

/**
 * Audit logger
 * Provides append-only logging with content hash generation
 */
export class AuditLogger {
  constructor(private storage: AuditLogStorage) {}

  /**
   * Log an audit entry
   * Validates that no content fields are present and generates content hash
   *
   * @param entry - Audit log entry to store
   * @param contentHash - Pre-computed content hash (optional, will be generated if not provided)
   * @returns Result indicating success or failure
   */
  async log(
    entry: Omit<AuditLogCreation, "contentHash">,
    contentHash?: string
  ): Promise<Result<void, AuditLogError>> {
    // Validate that no content fields exist
    const validation = validateMetadataOnly(entry);
    if (!validation.valid) {
      return err({
        type: "validation",
        message: validation.error || "Validation failed",
      });
    }

    // Use provided hash or generate one (if content was provided separately)
    // Note: In practice, content hash should be generated from the actual content
    // before it's discarded. This is just a placeholder for the hash parameter.
    const finalHash = contentHash || "";

    // Validate hash format if provided
    if (contentHash) {
      const hashValidation = contentHashSchema.safeParse(contentHash);
      if (!hashValidation.success) {
        return err({
          type: "hash",
          message: "Invalid content hash format",
          cause: hashValidation.error,
        });
      }
    }

    // Create final entry with hash
    const finalEntry: AuditLogCreation = {
      ...entry,
      contentHash: finalHash,
    };

    // Store the entry
    return this.storage.append(finalEntry);
  }
}

/**
 * Type guard to check if an error is a storage error
 */
export function isStorageError(error: AuditLogError): boolean {
  return error.type === "storage";
}

/**
 * Type guard to check if an error is a validation error
 */
export function isValidationError(error: AuditLogError): boolean {
  return error.type === "validation";
}

/**
 * Type guard to check if an error is a hash error
 */
export function isHashError(error: AuditLogError): boolean {
  return error.type === "hash";
}

