/**
 * URL Fetcher Module
 * 
 * Safely fetches URLs with SSRF protection, timeout enforcement,
 * and content extraction (metadata only, no content storage).
 */

import {
  validateSsrfSafeUrl,
  safeFetch,
  generateContentHash,
  Result,
  err,
  ok,
  FetchError as CoreFetchError,
} from "@safeurl/core";

// ============================================================================
// Types
// ============================================================================

export interface FetchOptions {
  timeoutMs: number;
  maxRedirectDepth: number;
}

export interface FetchResult {
  contentHash: string;
  httpStatus: number | null;
  httpHeaders: Record<string, string>;
  contentType: string | null;
  metadata: {
    title?: string;
    description?: string;
    metaTags?: Record<string, string>;
    linkCount?: number;
  };
}

export interface FetcherFetchError {
  type: "validation" | "network" | "http" | "timeout" | "parse";
  message: string;
}

// ============================================================================
// URL Fetching
// ============================================================================

/**
 * Fetches a URL safely with SSRF protection and timeout enforcement
 * 
 * @param url - URL to fetch
 * @param options - Fetch options (timeout, redirect depth)
 * @returns Result with fetch data (metadata only, no content)
 */
export async function fetchUrl(
  url: string,
  options: FetchOptions
): Promise<Result<FetchResult, FetcherFetchError>> {
  // Step 1: SSRF-safe URL validation
  const urlValidation = validateSsrfSafeUrl(url);
  if (urlValidation.isErr()) {
    return err({
      type: "validation",
      message: `Invalid URL: ${urlValidation.error}`,
    });
  }

  const validatedUrl = urlValidation.value;

  // Step 2: Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs);

  try {
    // Step 3: Fetch URL with safeFetch
    const fetchResult = await safeFetch<Response>(validatedUrl, {
      parseJson: false,
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (fetchResult.isErr()) {
      const error = fetchResult.error;
      if (error.type === "network") {
        // Check if it's a timeout
        if (
          error.cause instanceof Error &&
          error.cause.name === "AbortError"
        ) {
          return err({
            type: "timeout",
            message: `Fetch timeout after ${options.timeoutMs}ms`,
          });
        }
        return err({
          type: "network",
          message: `Network error: ${error.message}`,
        });
      } else if (error.type === "http") {
        // Even HTTP errors can provide useful metadata
        return extractMetadataFromErrorResponse(error, validatedUrl);
      } else {
        return err({
          type: "parse",
          message: `Parse error: ${error.message}`,
        });
      }
    }

    const response = fetchResult.value;

    // Step 4: Extract headers and content type
    const httpHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      // Sanitize headers (remove sensitive data)
      const lowerKey = key.toLowerCase();
      if (
        lowerKey !== "authorization" &&
        lowerKey !== "cookie" &&
        lowerKey !== "set-cookie"
      ) {
        httpHeaders[key] = value;
      }
    });

    const contentType = response.headers.get("content-type") || null;

    // Step 5: Read response body and generate hash (but don't store content)
    let contentHash: string;
    let bodyText: string;

    try {
      bodyText = await response.text();
    } catch (error) {
      return err({
        type: "network",
        message: `Failed to read response body: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }

    // Generate hash from content
    const hashResult = await generateContentHash(bodyText);
    if (hashResult.isErr()) {
      return err({
        type: "parse",
        message: `Failed to generate content hash: ${hashResult.error.message}`,
      });
    }

    contentHash = hashResult.value;

    // Step 6: Extract metadata from HTML (if applicable)
    const metadata = await extractHtmlMetadata(bodyText, contentType);

    // Step 7: Clear content from memory (explicitly)
    // Note: In JavaScript, we can't force garbage collection,
    // but we can nullify references to help GC
    bodyText = "" as any; // Clear reference

    // Step 8: Return result with metadata only
    return ok({
      contentHash,
      httpStatus: response.status,
      httpHeaders,
      contentType,
      metadata,
    });
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout
    if (error instanceof Error && error.name === "AbortError") {
      return err({
        type: "timeout",
        message: `Fetch timeout after ${options.timeoutMs}ms`,
      });
    }

    return err({
      type: "network",
      message: `Unexpected error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    });
  }
}

/**
 * Extract metadata from error response
 */
async function extractMetadataFromErrorResponse(
  error: CoreFetchError,
  url: string
): Promise<Result<FetchResult, FetcherFetchError>> {
  // For HTTP errors, we still want to return some metadata
  if (error.type === "http") {
    return ok({
      contentHash: "", // No content hash for error responses
      httpStatus: error.status,
      httpHeaders: {},
      contentType: null,
      metadata: {},
    });
  }

  return err({
    type: "network",
    message: error.message,
  });
}

/**
 * Extract HTML metadata without storing content
 * 
 * @param html - HTML content (will be cleared after processing)
 * @param contentType - Content type header
 * @returns Extracted metadata
 */
async function extractHtmlMetadata(
  html: string,
  contentType: string | null
): Promise<FetchResult["metadata"]> {
  const metadata: FetchResult["metadata"] = {};

  // Only parse HTML if content type indicates HTML
  if (!contentType || !contentType.includes("text/html")) {
    return metadata;
  }

  try {
    // Use DOMParser if available (Bun has this)
    // For a more robust solution, we could use a lightweight HTML parser
    // but for now, we'll use regex to extract basic metadata
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }

    // Extract meta description
    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i
    );
    if (descMatch) {
      metadata.description = descMatch[1].trim();
    }

    // Extract meta tags (basic)
    const metaTags: Record<string, string> = {};
    const metaRegex = /<meta[^>]*name=["']([^"']+)["'][^>]*content=["']([^"']+)["']/gi;
    let metaMatch;
    while ((metaMatch = metaRegex.exec(html)) !== null) {
      metaTags[metaMatch[1]] = metaMatch[2];
    }
    if (Object.keys(metaTags).length > 0) {
      metadata.metaTags = metaTags;
    }

    // Count links (approximate)
    const linkMatches = html.match(/<a[^>]*href/gi);
    if (linkMatches) {
      metadata.linkCount = linkMatches.length;
    }
  } catch (error) {
    // Metadata extraction failure is non-fatal
    // Just return empty metadata
  }

  return metadata;
}

