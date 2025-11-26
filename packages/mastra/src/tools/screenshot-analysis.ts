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
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }).optional(),
    contentType: z.string().optional(),
    isImageUrl: z.boolean().optional(),
  }),
});

// ============================================================================
// Debugging Utilities
// ============================================================================

const DEBUG_ENABLED =
  process.env.DEBUG_AGENT === "true" || process.env.NODE_ENV !== "production";

function debugLog(message: string, data?: any) {
  if (DEBUG_ENABLED) {
    const timestamp = new Date().toISOString();
    if (data !== undefined) {
      console.log(`[${timestamp}] [SCREENSHOT-ANALYSIS] ${message}`, data);
    } else {
      console.log(`[${timestamp}] [SCREENSHOT-ANALYSIS] ${message}`);
    }
  }
}

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Analyzes a URL by taking a screenshot and performing visual analysis
 * Screenshot is only kept in memory temporarily to generate hash
 */
export async function executeScreenshotAnalysis(
  input: z.infer<typeof screenshotAnalysisInputSchema>
): Promise<Result<z.infer<typeof screenshotAnalysisOutputSchema>, string>> {
  const startTime = Date.now();
  debugLog("🔍 Starting screenshot analysis", {
    url: input.url,
    viewport: input.viewport || { width: 1920, height: 1080 },
  });

  // Step 1: SSRF-safe URL validation
  debugLog("📋 Step 1: Validating URL (SSRF-safe)");
  const urlValidation = validateSsrfSafeUrl(input.url);
  if (urlValidation.isErr()) {
    debugLog("❌ URL validation failed", { error: urlValidation.error });
    return err(`Invalid URL: ${urlValidation.error}`);
  }

  const validatedUrl = urlValidation.value;
  const viewportWidth = input.viewport?.width ?? 1920;
  const viewportHeight = input.viewport?.height ?? 1080;
  debugLog("✅ URL validated", { validatedUrl, viewportWidth, viewportHeight });

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Step 2: Launch browser
    debugLog("🌐 Step 2: Launching Chromium browser");
    const browserStartTime = Date.now();
    browser = await chromium.launch({
      headless: true,
    });
    debugLog("✅ Browser launched", {
      duration: `${Date.now() - browserStartTime}ms`,
    });

    debugLog("📄 Creating new page", { viewportWidth, viewportHeight });
    page = await browser.newPage({
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
      },
    });
    debugLog("✅ Page created");

    // Step 3: Navigate to URL with timeout and get response
    debugLog("🚀 Step 3: Navigating to URL", {
      url: validatedUrl,
      waitUntil: "networkidle",
      timeout: 30000,
    });
    const navigationStartTime = Date.now();
    const response = await page.goto(validatedUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    const navigationDuration = Date.now() - navigationStartTime;
    debugLog("✅ Navigation completed", {
      duration: `${navigationDuration}ms`,
      status: response?.status(),
      statusText: response?.statusText(),
    });

    // Step 4: Detect content type and check if it's a direct image URL
    debugLog("🔍 Step 4: Detecting content type");
    // Check response headers for content type
    const responseHeaders = response?.headers() || {};
    const contentType = responseHeaders["content-type"] || "unknown";

    // Check if URL points directly to an image
    const isImageUrl =
      /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/i.test(validatedUrl) ||
      contentType?.includes("image");
    debugLog("✅ Content type detected", {
      contentType,
      isImageUrl,
      urlPatternMatch: /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/i.test(
        validatedUrl
      ),
    });

    // Step 5: Capture screenshot (in-memory buffer)
    debugLog("📸 Step 5: Capturing screenshot");
    const screenshotStartTime = Date.now();
    const imageFormat = input.imageFormat || "png";
    const quality = input.quality || 85;
    const screenshotBuffer = await page.screenshot({
      type: imageFormat,
      quality: imageFormat === "jpeg" ? quality : undefined,
      fullPage: false,
    });
    const screenshotSize = screenshotBuffer.length;
    debugLog("✅ Screenshot captured", {
      duration: `${Date.now() - screenshotStartTime}ms`,
      size: `${(screenshotSize / 1024).toFixed(2)} KB`,
      type: imageFormat,
      ...(imageFormat === "jpeg" ? { quality } : {}),
    });

    // Step 6: Generate screenshot hash and base64 for vision model
    debugLog("🔐 Step 6: Generating screenshot hash and base64");
    const hashStartTime = Date.now();
    const screenshotBase64 = screenshotBuffer.toString("base64");
    const hashResult = await generateContentHash(screenshotBase64);
    if (hashResult.isErr()) {
      debugLog("❌ Hash generation failed", {
        error: hashResult.error.message,
      });
      return err(
        `Failed to generate screenshot hash: ${hashResult.error.message}`
      );
    }
    const screenshotHash = hashResult.value;
    debugLog("✅ Hash generated", {
      duration: `${Date.now() - hashStartTime}ms`,
      hash: screenshotHash.substring(0, 16) + "...",
      base64Length: screenshotBase64.length,
    });

    // Step 7: Perform basic visual analysis
    debugLog("🔍 Step 7: Performing visual analysis");
    const analysisStartTime = Date.now();
    const suspiciousElements: string[] = [];
    let layoutAnalysis = isImageUrl ? "Image URL" : "Web page";

    // Extract text content and analyze for suspicious patterns
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

    // Check for form elements (potential phishing)
    const formCount = await page.locator("form").count();
    if (formCount > 0) {
      suspiciousElements.push(`${formCount} form(s)`);
    }

    debugLog("✅ Visual analysis completed", {
      duration: `${Date.now() - analysisStartTime}ms`,
      suspiciousElementsCount: suspiciousElements.length,
    });

    const totalDuration = Date.now() - startTime;
    debugLog("✅ Screenshot analysis completed successfully", {
      totalDuration: `${totalDuration}ms`,
      screenshotHash: screenshotHash.substring(0, 16) + "...",
      suspiciousElementsCount: suspiciousElements.length,
      isImageUrl,
    });

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
    const totalDuration = Date.now() - startTime;
    debugLog("❌ Screenshot analysis failed", {
      duration: `${totalDuration}ms`,
      // error: error instanceof Error ? error.message : "Unknown error",
      // stack:
      //   error instanceof Error ? error.stack?.substring(0, 500) : undefined,
    });
    return err(
      `Screenshot analysis failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  } finally {
    // Step 8: Clean up - ensure browser is closed
    debugLog("🧹 Step 8: Cleaning up browser resources");
    const cleanupStartTime = Date.now();
    if (page) {
      await page.close().catch((err) => {
        debugLog("⚠️ Error closing page");
      });
    }
    if (browser) {
      await browser.close().catch((err) => {
        debugLog("⚠️ Error closing browser");
      });
    }
    debugLog("✅ Cleanup completed", {
      duration: `${Date.now() - cleanupStartTime}ms`,
    });
  }
}

/**
 * Screenshot analysis tool for Mastra agent
 * Takes screenshots and performs visual analysis without storing images
 *
 * This tool uses Playwright to capture visual content (screenshots) of URLs.
 * The agent can analyze these screenshots visually to detect:
 * - NSFW/explicit imagery
 * - Phishing layouts and fake login pages
 * - Suspicious visual patterns
 * - Inappropriate content
 * - Image content (for direct image URLs)
 */
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
