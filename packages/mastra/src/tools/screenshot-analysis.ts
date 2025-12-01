import { createTool } from "@mastra/core/tools";
import { generateContentHash, validateSsrfSafeUrl } from "@safeurl/core/utils";
import { err, ok, Result } from "neverthrow";
import { z } from "zod";

const screenshotAnalysisInputSchema = z.object({
  url: z.string().url(),
  viewport: z
    .object({
      width: z.number().default(1920),
      height: z.number().default(1080),
    })
    .optional(),
  imageFormat: z.enum(["png", "jpeg"]).default("png").optional(),
  quality: z.number().min(0).max(100).default(85).optional(), // For JPEG
});

const screenshotAnalysisOutputSchema = z.object({
  screenshotHash: z.string(),
  screenshotBase64: z.string().optional(), // For vision model analysis
  visualAnalysis: z.object({
    suspiciousElements: z.array(z.string()),
    layoutAnalysis: z.string(),
  }),
  metadata: z.object({
    viewport: z
      .object({
        width: z.number(),
        height: z.number(),
      })
      .optional(),
    contentType: z.string().optional(),
    isImageUrl: z.boolean().optional(),
  }),
});

/**
 * Screenshot generation options
 */
export interface ScreenshotOptions {
  viewport: {
    width: number;
    height: number;
  };
  imageFormat: "png" | "jpeg";
  quality: number;
}

/**
 * Metadata returned from screenshot generation
 */
export interface ScreenshotMetadata {
  contentType: string;
  isImageUrl: boolean;
  pageText?: string;
  formCount?: number;
}

/**
 * Result of screenshot generation
 */
export interface ScreenshotResult {
  screenshotBuffer: Buffer;
  metadata: ScreenshotMetadata;
}

/**
 * Function type for screenshot generation.
 * This abstraction allows different implementations (Playwright, Puppeteer, Cloudflare Workers, etc.)
 */
export type ScreenshotGenerator = (
  url: string,
  options: ScreenshotOptions,
) => Promise<Result<ScreenshotResult, string>>;

export async function executeScreenshotAnalysis(
  input: z.infer<typeof screenshotAnalysisInputSchema>,
  screenshotGenerator: ScreenshotGenerator,
): Promise<Result<z.infer<typeof screenshotAnalysisOutputSchema>, string>> {
  const urlValidation = validateSsrfSafeUrl(input.url);
  if (urlValidation.isErr()) {
    return err(`Invalid URL: ${urlValidation.error}`);
  }

  const validatedUrl = urlValidation.value;
  const viewportWidth = input.viewport?.width ?? 1920;
  const viewportHeight = input.viewport?.height ?? 1080;
  const imageFormat = input.imageFormat || "png";
  const quality = input.quality || 85;

  try {
    const screenshotResult = await screenshotGenerator(validatedUrl, {
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
      },
      imageFormat,
      quality,
    });

    if (screenshotResult.isErr()) {
      return err(screenshotResult.error);
    }

    const { screenshotBuffer, metadata } = screenshotResult.value;
    const screenshotBase64 = screenshotBuffer.toString("base64");
    const hashResult = await generateContentHash(screenshotBase64);
    if (hashResult.isErr()) {
      return err(
        `Failed to generate screenshot hash: ${hashResult.error.message}`,
      );
    }
    const screenshotHash = hashResult.value;

    const suspiciousElements: string[] = [];
    let layoutAnalysis = metadata.isImageUrl ? "Image URL" : "Web page";

    if (metadata.pageText) {
      const suspiciousPatterns = [
        /verify.*account/i,
        /suspended.*account/i,
        /urgent.*action/i,
        /click.*here.*immediately/i,
        /your.*account.*will.*be.*closed/i,
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(metadata.pageText)) {
          suspiciousElements.push(`Suspicious pattern: ${pattern.source}`);
        }
      }

      const textLength = metadata.pageText.length;
      if (textLength < 100) layoutAnalysis = "Minimal content";
      else if (textLength > 10000) layoutAnalysis = "Extensive content";
    }

    if (metadata.formCount !== undefined && metadata.formCount > 0) {
      suspiciousElements.push(`${metadata.formCount} form(s)`);
    }

    return ok({
      screenshotHash,
      screenshotBase64,
      visualAnalysis: {
        suspiciousElements,
        layoutAnalysis,
      },
      metadata: {
        contentType: metadata.contentType || "unknown",
        isImageUrl: metadata.isImageUrl,
      },
    });
  } catch (error) {
    return err(
      `Screenshot analysis failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

/**
 * Creates a screenshot analysis tool with the provided screenshot generator.
 * This allows for dependency injection and Cloudflare compatibility.
 *
 * @param screenshotGenerator - Function that generates screenshots from URLs
 * @returns A configured screenshot analysis tool
 */
export function createScreenshotAnalysisTool(
  screenshotGenerator: ScreenshotGenerator,
) {
  return createTool({
    id: "screenshot-analysis",
    description:
      "Captures screenshots of URLs for visual analysis. Detects NSFW content, phishing layouts, suspicious elements. Use FIRST for image URLs or visual analysis. SSRF-safe.",
    inputSchema: screenshotAnalysisInputSchema,
    outputSchema: screenshotAnalysisOutputSchema,
    execute: async ({
      context,
    }: {
      context: z.infer<typeof screenshotAnalysisInputSchema>;
    }) => {
      const result = await executeScreenshotAnalysis(
        context,
        screenshotGenerator,
      );
      if (result.isErr()) {
        throw new Error(result.error);
      }
      return result.value;
    },
  });
}
