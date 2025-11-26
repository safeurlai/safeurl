import { z } from "zod";
import { Result, ok, err } from "neverthrow";
import { createTool } from "@mastra/core/tools";
import { validateSsrfSafeUrl, generateContentHash } from "@safeurl/core/utils";
import { safeFetch } from "@safeurl/core/result";

// ============================================================================
// Schemas
// ============================================================================

const contentExtractionInputSchema = z.object({
  url: z.string().url(),
  options: z
    .object({
      timeout: z.number().optional(),
      followRedirects: z.boolean().optional(),
    })
    .optional(),
});

const contentExtractionOutputSchema = z.object({
  metadata: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    contentHash: z.string(),
    contentType: z.string(),
    httpStatus: z.number(),
    headers: z.record(z.string()).optional(), // Only include essential headers
  }),
});

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Extracts metadata from a URL without storing content
 * Uses SSRF-safe URL validation and only returns metadata/hashes
 */
async function executeContentExtraction(
  input: z.infer<typeof contentExtractionInputSchema>
): Promise<Result<z.infer<typeof contentExtractionOutputSchema>, string>> {
  // Step 1: SSRF-safe URL validation
  const urlValidation = validateSsrfSafeUrl(input.url);
  if (urlValidation.isErr()) {
    return err(`Invalid URL: ${urlValidation.error}`);
  }

  const validatedUrl = urlValidation.value;

  // Step 2: Fetch URL with safeFetch
  const fetchResult = await safeFetch<Response>(validatedUrl, {
    parseJson: false,
    ...input.options,
  });

  if (fetchResult.isErr()) {
    const error = fetchResult.error;
    if (error.type === "network") {
      return err(`Network error: ${error.message}`);
    } else if (error.type === "http") {
      return err(`HTTP error: ${error.status} ${error.statusText}`);
    } else {
      return err(`Parse error: ${error.message}`);
    }
  }

  const response = fetchResult.value;

  // Step 3: Extract essential headers only (reduce token usage)
  const essentialHeaders = ["content-type", "content-length", "server", "x-frame-options", "x-content-type-options"];
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (essentialHeaders.includes(key.toLowerCase())) {
      headers[key] = value;
    }
  });

  // Step 4: Get content type
  const contentType = response.headers.get("content-type") || "unknown";

  // Step 5: Read response body once and generate hash (but don't store content)
  let contentHash: string;
  let bodyText: string;
  try {
    bodyText = await response.text();
    const hashResult = await generateContentHash(bodyText);
    if (hashResult.isErr()) {
      return err(
        `Failed to generate content hash: ${hashResult.error.message}`
      );
    }
    contentHash = hashResult.value;
  } catch (error) {
    return err(
      `Failed to read response body: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  // Step 6: Extract basic metadata from HTML if applicable
  let title: string | undefined;
  let description: string | undefined;

  if (contentType.includes("text/html")) {
    try {
      // Parse HTML to extract title and description (basic parsing)
      // We only extract metadata, not full content
      const titleMatch = bodyText.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }

      const descMatch = bodyText.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
      );
      if (descMatch) {
        description = descMatch[1].trim();
      }
    } catch {
      // If parsing fails, continue without metadata
    }
  }

  return ok({
    metadata: {
      title,
      description,
      contentHash,
      contentType,
      httpStatus: response.status,
      ...(Object.keys(headers).length > 0 && { headers }),
    },
  });
}

/**
 * Content extraction tool for Mastra agent
 * Extracts metadata from URLs without storing content
 */
export const contentExtractionTool = createTool({
  id: "content-extraction",
  description:
    "Extracts URL metadata (title, description, headers, hash) without storing content. SSRF-safe.",
  inputSchema: contentExtractionInputSchema,
  outputSchema: contentExtractionOutputSchema,
  execute: async ({
    context,
  }: {
    context: z.infer<typeof contentExtractionInputSchema>;
  }) => {
    const result = await executeContentExtraction(context);
    if (result.isErr()) {
      throw new Error(result.error);
    }
    return result.value;
  },
});
