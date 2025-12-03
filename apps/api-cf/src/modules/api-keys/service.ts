import {
  err,
  ok,
  Result,
  wrapDbQuery,
  type ApiKeyCreation,
} from "@safeurl/core";
import { apiKeys, users, type DatabaseInstance } from "@safeurl/db";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Service errors
 */
interface ServiceError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Generate a secure random API key
 * Format: sk_live_<base64url-random-string>
 */
function generateApiKey(): string {
  // Generate 32 random bytes (256 bits)
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  // Convert to base64url (URL-safe base64)
  const base64url = btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `sk_live_${base64url}`;
}

/**
 * Hash an API key using SHA-256
 */
async function hashApiKey(key: string): Promise<Result<string, ServiceError>> {
  try {
    const data = new TextEncoder().encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return ok(hashHex);
  } catch (error) {
    return err({
      code: "hashing_error",
      message:
        error instanceof Error ? error.message : "Failed to hash API key",
      details: error,
    });
  }
}

/**
 * Ensure user exists in database
 */
async function ensureUserExists(
  db: DatabaseInstance["db"],
  userId: string,
): Promise<void> {
  try {
    await db.insert(users).values({
      clerkUserId: userId,
    });
  } catch (error) {
    // User might already exist, verify by selecting
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, userId))
      .limit(1);
    if (existing.length === 0) {
      // User doesn't exist and insert failed, re-throw
      throw error;
    }
    // User exists now, continue
  }
}

/**
 * Create a new API key
 * Returns the plaintext key (only time it's available)
 */
export async function createApiKey(
  dbInstance: ReturnType<typeof import("../../lib/db").getDb>,
  userId: string,
  request: ApiKeyCreation,
): Promise<
  Result<
    { id: string; key: string; name: string; createdAt: Date },
    ServiceError
  >
> {
  // Retry loop for hash collision (extremely rare)
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts++;

    const resultAsync = wrapDbQuery(async () => {
      // Ensure user exists
      await ensureUserExists(dbInstance, userId);

      // Generate API key
      const plaintextKey = generateApiKey();

      // Hash the key
      const hashResult = await hashApiKey(plaintextKey);
      if (hashResult.isErr()) {
        throw new Error(hashResult.error.message);
      }
      const keyHash = hashResult.value;

      // Check if hash already exists (extremely unlikely but handle it)
      const existing = await dbInstance
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash))
        .limit(1);

      if (existing.length > 0) {
        // Hash collision - will retry in outer loop
        throw new Error("Hash collision - retrying");
      }

      // Insert API key
      const expiresAt = request.expiresAt ? new Date(request.expiresAt) : null;

      const [newKey] = await dbInstance
        .insert(apiKeys)
        .values({
          userId,
          keyHash,
          name: request.name,
          scopes: request.scopes,
          expiresAt,
        })
        .returning();

      return {
        id: newKey.id,
        key: plaintextKey, // Only time we return the plaintext
        name: newKey.name,
        createdAt: newKey.createdAt,
      };
    });

    const result = await resultAsync;

    if (result.isErr()) {
      const dbError = result.error;

      // If it's a hash collision, retry
      if (dbError.message === "Hash collision - retrying") {
        continue;
      }

      return err({
        code: `database_${dbError.type}_error`,
        message: dbError.message || "Database error occurred",
        details: dbError,
      });
    }

    return ok(result.value);
  }

  // If we've exhausted retries, return error
  return err({
    code: "key_generation_failed",
    message: "Failed to generate unique API key after multiple attempts",
  });
}

/**
 * List all non-revoked API keys for a user
 */
export async function listApiKeys(
  dbInstance: ReturnType<typeof import("../../lib/db").getDb>,
  userId: string,
): Promise<
  Result<
    Array<{
      id: string;
      name: string;
      scopes: string[];
      expiresAt: Date | null;
      lastUsedAt: Date | null;
      createdAt: Date;
      revokedAt: Date | null;
    }>,
    ServiceError
  >
> {
  const resultAsync = wrapDbQuery(async () => {
    const keys = await dbInstance
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        scopes: apiKeys.scopes,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(apiKeys.createdAt);

    return keys;
  });

  const result = await resultAsync;

  if (result.isErr()) {
    const dbError = result.error;
    return err({
      code: `database_${dbError.type}_error`,
      message: dbError.message || "Database error occurred",
      details: dbError,
    });
  }

  return ok(result.value);
}

/**
 * Revoke an API key (soft delete)
 */
export async function revokeApiKey(
  dbInstance: ReturnType<typeof import("../../lib/db").getDb>,
  userId: string,
  keyId: string,
): Promise<Result<{ id: string }, ServiceError>> {
  const resultAsync = wrapDbQuery(async () => {
    // Verify key belongs to user
    const [key] = await dbInstance
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .limit(1);

    if (!key) {
      throw new Error("API key not found");
    }

    if (key.revokedAt) {
      throw new Error("API key already revoked");
    }

    // Revoke the key
    await dbInstance
      .update(apiKeys)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, keyId));

    return { id: keyId };
  });

  const result = await resultAsync;

  if (result.isErr()) {
    const dbError = result.error;
    return err({
      code:
        dbError.message === "API key not found"
          ? "not_found"
          : dbError.message === "API key already revoked"
            ? "already_revoked"
            : `database_${dbError.type}_error`,
      message: dbError.message || "Database error occurred",
      details: dbError,
    });
  }

  return ok(result.value);
}

/**
 * Validate an API key and return user ID
 */
export async function validateApiKey(
  dbInstance: ReturnType<typeof import("../../lib/db").getDb>,
  key: string,
): Promise<
  Result<
    {
      userId: string;
      keyId: string;
      scopes: string[];
    },
    ServiceError
  >
> {
  // Hash the provided key
  const hashResult = await hashApiKey(key);
  if (hashResult.isErr()) {
    return err({
      code: "invalid_key",
      message: "Invalid API key format",
    });
  }
  const keyHash = hashResult.value;

  const resultAsync = wrapDbQuery(async () => {
    // Lookup key by hash
    const [keyRecord] = await dbInstance
      .select({
        id: apiKeys.id,
        userId: apiKeys.userId,
        scopes: apiKeys.scopes,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    if (!keyRecord) {
      throw new Error("API key not found");
    }

    // Check if revoked
    if (keyRecord.revokedAt) {
      throw new Error("API key has been revoked");
    }

    // Check if expired
    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      throw new Error("API key has expired");
    }

    return {
      userId: keyRecord.userId,
      keyId: keyRecord.id,
      scopes: keyRecord.scopes,
    };
  });

  const result = await resultAsync;

  if (result.isErr()) {
    const dbError = result.error;
    return err({
      code:
        dbError.message === "API key not found"
          ? "invalid_key"
          : dbError.message === "API key has been revoked"
            ? "revoked_key"
            : dbError.message === "API key has expired"
              ? "expired_key"
              : `database_${dbError.type}_error`,
      message: dbError.message || "Database error occurred",
      details: dbError,
    });
  }

  return ok(result.value);
}

/**
 * Update last used timestamp for an API key
 */
export async function updateLastUsed(
  dbInstance: ReturnType<typeof import("../../lib/db").getDb>,
  keyId: string,
): Promise<Result<void, ServiceError>> {
  const resultAsync = wrapDbQuery(async () => {
    await dbInstance
      .update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, keyId));
  });

  const result = await resultAsync;

  if (result.isErr()) {
    const dbError = result.error;
    return err({
      code: `database_${dbError.type}_error`,
      message: dbError.message || "Database error occurred",
      details: dbError,
    });
  }

  return ok(undefined);
}
