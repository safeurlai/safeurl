import { createLogger } from "@safeurl/core/logger";
import { err, ok, Result, wrapDbQuery } from "@safeurl/core/result";
import { and, desc, eq, gte, scanResults } from "@safeurl/db";

import { db } from "./db";

const logger = createLogger({ prefix: "cache" });

/**
 * Cache configuration
 */
export interface CacheConfig {
  /**
   * Cache TTL in seconds (default: 30 days)
   * Results older than this will be considered stale
   */
  ttlSeconds?: number;
}

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Cached scan result
 */
export interface CachedScanResult {
  riskScore: number;
  categories: string[];
  contentHash: string;
  httpStatus: number | null;
  httpHeaders: Record<string, string> | null;
  contentType: string | null;
  modelUsed: string;
  analysisMetadata: Record<string, unknown> | null;
  reasoning: string;
  indicators: string[];
  createdAt: Date;
}

/**
 * Cache lookup error
 */
export interface CacheLookupError {
  type: "database_error" | "not_found";
  message: string;
  details?: unknown;
}

/**
 * Get cached scan result by contentHash
 *
 * Returns the most recent result for the given contentHash if it exists
 * and is not expired (within TTL).
 *
 * @param contentHash - SHA-256 hash of the content
 * @param config - Cache configuration
 * @returns Cached result or error
 */
export async function getCachedResult(
  contentHash: string,
  config: CacheConfig = {},
): Promise<Result<CachedScanResult, CacheLookupError>> {
  const ttlSeconds = config.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const ttlTimestamp = new Date(Date.now() - ttlSeconds * 1000);

  logger.info("Checking cache for contentHash", {
    contentHash: contentHash.substring(0, 16) + "...",
    ttlSeconds,
    ttlTimestamp: ttlTimestamp.toISOString(),
  });

  const resultAsync = wrapDbQuery(async () => {
    // Find the most recent result for this contentHash that's within TTL
    const cachedResults = await db
      .select()
      .from(scanResults)
      .where(
        and(
          eq(scanResults.contentHash, contentHash),
          gte(scanResults.createdAt, ttlTimestamp),
        ),
      )
      .orderBy(desc(scanResults.createdAt))
      .limit(1);

    if (cachedResults.length === 0) {
      logger.info("Cache miss - no valid cached result found", {
        contentHash: contentHash.substring(0, 16) + "...",
      });
      throw new Error("Cached result not found");
    }

    const cached = cachedResults[0];

    logger.info("Cache hit - found valid cached result", {
      contentHash: contentHash.substring(0, 16) + "...",
      jobId: cached.jobId,
      riskScore: cached.riskScore,
      createdAt: cached.createdAt.toISOString(),
      ageSeconds: Math.floor((Date.now() - cached.createdAt.getTime()) / 1000),
    });

    return {
      riskScore: cached.riskScore,
      categories: cached.categories,
      contentHash: cached.contentHash,
      httpStatus: cached.httpStatus,
      httpHeaders: cached.httpHeaders,
      contentType: cached.contentType,
      modelUsed: cached.modelUsed,
      analysisMetadata: cached.analysisMetadata,
      reasoning: cached.reasoning,
      indicators: cached.indicators,
      createdAt: cached.createdAt,
    } satisfies CachedScanResult;
  });

  const result = await resultAsync;

  if (result.isErr()) {
    const dbError = result.error;
    const errorMessage = dbError.message || "Database error occurred";

    if (errorMessage.includes("not found")) {
      return err({
        type: "not_found",
        message: "Cached result not found",
      });
    }

    return err({
      type: "database_error",
      message: errorMessage,
      details: dbError,
    });
  }

  return ok(result.value);
}
