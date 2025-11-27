import {
  validateSsrfSafeUrl,
  safeFetch,
  generateContentHash,
  Result,
  err,
  ok,
  FetchError as CoreFetchError,
} from "@safeurl/core";

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

export async function fetchUrl(
  url: string,
  options: FetchOptions
): Promise<Result<FetchResult, FetcherFetchError>> {
  const urlValidation = validateSsrfSafeUrl(url);
  if (urlValidation.isErr()) {
    return err({
      type: "validation",
      message: `Invalid URL: ${urlValidation.error}`,
    });
  }

  const validatedUrl = urlValidation.value;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs);

  try {
    const fetchResult = await safeFetch<Response>(validatedUrl, {
      parseJson: false,
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (fetchResult.isErr()) {
      const error = fetchResult.error;
      if (error.type === "network") {
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
        return extractMetadataFromErrorResponse(error, validatedUrl);
      } else {
        return err({
          type: "parse",
          message: `Parse error: ${error.message}`,
        });
      }
    }

    const response = fetchResult.value;

    const httpHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
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

    const hashResult = await generateContentHash(bodyText);
    if (hashResult.isErr()) {
      return err({
        type: "parse",
        message: `Failed to generate content hash: ${hashResult.error.message}`,
      });
    }

    contentHash = hashResult.value;

    const metadata = await extractHtmlMetadata(bodyText, contentType);

    bodyText = "" as any;

    return ok({
      contentHash,
      httpStatus: response.status,
      httpHeaders,
      contentType,
      metadata,
    });
  } catch (error) {
    clearTimeout(timeoutId);

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

async function extractMetadataFromErrorResponse(
  error: CoreFetchError,
  url: string
): Promise<Result<FetchResult, FetcherFetchError>> {
  if (error.type === "http") {
    return ok({
      contentHash: "",
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

async function extractHtmlMetadata(
  html: string,
  contentType: string | null
): Promise<FetchResult["metadata"]> {
  const metadata: FetchResult["metadata"] = {};

  if (!contentType || !contentType.includes("text/html")) {
    return metadata;
  }

  try {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }

    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i
    );
    if (descMatch) {
      metadata.description = descMatch[1].trim();
    }

    const metaTags: Record<string, string> = {};
    const metaRegex = /<meta[^>]*name=["']([^"']+)["'][^>]*content=["']([^"']+)["']/gi;
    let metaMatch;
    while ((metaMatch = metaRegex.exec(html)) !== null) {
      metaTags[metaMatch[1]] = metaMatch[2];
    }
    if (Object.keys(metaTags).length > 0) {
      metadata.metaTags = metaTags;
    }

    const linkMatches = html.match(/<a[^>]*href/gi);
    if (linkMatches) {
      metadata.linkCount = linkMatches.length;
    }
  } catch (error) {
  }

  return metadata;
}

