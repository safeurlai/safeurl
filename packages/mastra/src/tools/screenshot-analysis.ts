import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { validateSsrfSafeUrl, generateContentHash } from "@safeurl/core/utils";
import { Result, ok, err } from "neverthrow";
import { chromium, Browser, Page } from "playwright";

// ============================================================================
// Schemas
// ============================================================================

const screenshotAnalysisInputSchema = z.object({
  url: z.string().url(),
  viewport: z
    .object({
      width: z.number().default(1920),
      height: z.number().default(1080),
    })
    .optional(),
});

const screenshotAnalysisOutputSchema = z.object({
  screenshotHash: z.string(), // Hash of screenshot, not screenshot itself
  visualAnalysis: z.object({
    suspiciousElements: z.array(z.string()),
    layoutAnalysis: z.string(),
  }),
  metadata: z.object({
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }),
  }),
});

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Analyzes a URL by taking a screenshot and performing visual analysis
 * Screenshot is only kept in memory temporarily to generate hash
 */
async function executeScreenshotAnalysis(
  input: z.infer<typeof screenshotAnalysisInputSchema>
): Promise<Result<z.infer<typeof screenshotAnalysisOutputSchema>, string>> {
  // Step 1: SSRF-safe URL validation
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
    // Step 2: Launch browser
    browser = await chromium.launch({
      headless: true,
    });

    page = await browser.newPage({
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
      },
    });

    // Step 3: Navigate to URL with timeout
    await page.goto(validatedUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Step 4: Capture screenshot (in-memory buffer)
    const screenshotBuffer = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    // Step 5: Generate screenshot hash
    const hashResult = await generateContentHash(
      screenshotBuffer.toString("base64")
    );
    if (hashResult.isErr()) {
      return err(
        `Failed to generate screenshot hash: ${hashResult.error.message}`
      );
    }
    const screenshotHash = hashResult.value;

    // Step 6: Perform basic visual analysis
    // Extract text content and analyze for suspicious patterns
    const pageText = await page.textContent("body");
    const suspiciousElements: string[] = [];
    let layoutAnalysis = "Standard web page layout";

    // Check for suspicious patterns in text
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
          suspiciousElements.push(
            `Suspicious text pattern detected: ${pattern}`
          );
        }
      }

      // Basic layout analysis
      const textLength = pageText.length;
      if (textLength < 100) {
        layoutAnalysis = "Very minimal content, potentially suspicious";
      } else if (textLength > 10000) {
        layoutAnalysis = "Extensive content, likely legitimate";
      }
    }

    // Check for form elements (potential phishing)
    const formCount = await page.locator("form").count();
    if (formCount > 0) {
      suspiciousElements.push(
        `Contains ${formCount} form(s) - potential credential harvesting`
      );
    }

    // Check for external links
    const externalLinks = await page.locator("a[href^='http']").count();
    if (externalLinks > 10) {
      suspiciousElements.push(
        `High number of external links: ${externalLinks}`
      );
    }

    return ok({
      screenshotHash,
      visualAnalysis: {
        suspiciousElements,
        layoutAnalysis,
      },
      metadata: {
        viewport: {
          width: viewportWidth,
          height: viewportHeight,
        },
      },
    });
  } catch (error) {
    return err(
      `Screenshot analysis failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  } finally {
    // Step 7: Clean up - ensure browser is closed
    if (page) {
      await page.close().catch(() => {
        // Ignore cleanup errors
      });
    }
    if (browser) {
      await browser.close().catch(() => {
        // Ignore cleanup errors
      });
    }
  }
}

/**
 * Screenshot analysis tool for Mastra agent
 * Takes screenshots and performs visual analysis without storing images
 */
export const screenshotAnalysisTool = createTool({
  id: "screenshot-analysis",
  description:
    "Takes a screenshot of a URL and performs visual analysis to detect suspicious elements. Screenshot is only kept in memory temporarily to generate a hash. Uses SSRF-safe URL validation.",
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
