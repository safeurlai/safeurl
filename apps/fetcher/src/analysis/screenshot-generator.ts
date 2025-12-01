import { err, ok, Result } from "@safeurl/core";
import type {
  ScreenshotGenerator,
  ScreenshotOptions,
  ScreenshotResult,
} from "@safeurl/mastra";
import { Browser, chromium, Page } from "playwright";

/**
 * Creates a Playwright-based screenshot generator.
 * This requires playwright to be installed as a dependency.
 *
 * @returns A screenshot generator function using Playwright
 */
export function createPlaywrightScreenshotGenerator(): ScreenshotGenerator {
  return async (
    url: string,
    options: ScreenshotOptions,
  ): Promise<Result<ScreenshotResult, string>> => {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      browser = await chromium.launch({
        headless: true,
      });

      page = await browser.newPage({
        viewport: {
          width: options.viewport.width,
          height: options.viewport.height,
        },
      });

      const response = await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      const responseHeaders = response?.headers() || {};
      const contentType = responseHeaders["content-type"] || "unknown";

      const isImageUrl =
        /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/i.test(url) ||
        contentType?.includes("image");

      const screenshotBuffer = await page.screenshot({
        type: options.imageFormat,
        quality: options.imageFormat === "jpeg" ? options.quality : undefined,
        fullPage: false,
      });

      const pageText = await page.textContent("body").catch(() => null);
      const formCount = await page
        .locator("form")
        .count()
        .catch(() => 0);

      return ok({
        screenshotBuffer: Buffer.from(screenshotBuffer),
        metadata: {
          contentType,
          isImageUrl,
          pageText: pageText || undefined,
          formCount,
        },
      });
    } catch (error) {
      return err(
        `Playwright screenshot generation failed: ${
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
  };
}
