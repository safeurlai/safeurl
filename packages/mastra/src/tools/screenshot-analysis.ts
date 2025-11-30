import { createTool } from "@mastra/core/tools";
import { generateContentHash, validateSsrfSafeUrl } from "@safeurl/core/utils";
import { err, ok, Result } from "neverthrow";
import { Browser, chromium, Page } from "playwright";
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

export async function executeScreenshotAnalysis(
  input: z.infer<typeof screenshotAnalysisInputSchema>,
): Promise<Result<z.infer<typeof screenshotAnalysisOutputSchema>, string>> {
  const urlValidation = validateSsrfSafeUrl(input.url);
  if (urlValidation.isErr()) {
    return err(`Invalid URL: ${urlValidation.error}`);
  }

  const validatedUrl = urlValidation.value;
  const viewportWidth = input.viewport?.width ?? 1920;
  const viewportHeight = input.viewport?.height ?? 1080;

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
    });

    page = await browser.newPage({
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
      },
    });

    const response = await page.goto(validatedUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    const responseHeaders = response?.headers() || {};
    const contentType = responseHeaders["content-type"] || "unknown";

    const isImageUrl =
      /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/i.test(validatedUrl) ||
      contentType?.includes("image");

    const imageFormat = input.imageFormat || "png";
    const quality = input.quality || 85;
    const screenshotBuffer = await page.screenshot({
      type: imageFormat,
      quality: imageFormat === "jpeg" ? quality : undefined,
      fullPage: false,
    });

    const screenshotBase64 = screenshotBuffer.toString("base64");
    const hashResult = await generateContentHash(screenshotBase64);
    if (hashResult.isErr()) {
      return err(
        `Failed to generate screenshot hash: ${hashResult.error.message}`,
      );
    }
    const screenshotHash = hashResult.value;

    const suspiciousElements: string[] = [];
    let layoutAnalysis = isImageUrl ? "Image URL" : "Web page";

    const pageText = await page.textContent("body");
    if (pageText) {
      const suspiciousPatterns = [
        /verify.*account/i,
        /suspended.*account/i,
        /urgent.*action/i,
        /click.*here.*immediately/i,
        /your.*account.*will.*be.*closed/i,
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(pageText)) {
          suspiciousElements.push(`Suspicious pattern: ${pattern.source}`);
        }
      }

      const textLength = pageText.length;
      if (textLength < 100) layoutAnalysis = "Minimal content";
      else if (textLength > 10000) layoutAnalysis = "Extensive content";
    }

    const formCount = await page.locator("form").count();
    if (formCount > 0) {
      suspiciousElements.push(`${formCount} form(s)`);
    }

    return ok({
      screenshotHash,
      screenshotBase64,
      visualAnalysis: {
        suspiciousElements,
        layoutAnalysis,
      },
      metadata: {
        contentType: contentType || "unknown",
        isImageUrl,
      },
    });
  } catch (error) {
    return err(
      `Screenshot analysis failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

export const screenshotAnalysisTool = createTool({
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
    const result = await executeScreenshotAnalysis(context);
    if (result.isErr()) {
      throw new Error(result.error);
    }
    return result.value;
  },
});
