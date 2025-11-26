#!/usr/bin/env bun

/**
 * Fetcher Container Entry Point
 *
 * Ephemeral container that safely fetches URLs, performs analysis using Mastra agents,
 * and returns results without persisting any content.
 *
 * Usage:
 *   bun run src/index.ts --job-id <uuid> --url <url>
 *   or via environment variables:
 *   JOB_ID=<uuid> SCAN_URL=<url> bun run src/index.ts
 */

// Disable Mastra telemetry warnings (we're running outside Mastra server environment)
// Setting this to true tells Mastra that telemetry is handled externally
if (typeof globalThis !== "undefined") {
  (globalThis as any).___MASTRA_TELEMETRY___ = true;
}

import { fetchUrl } from "./fetch/url-fetcher";
import { analyzeWithAgent } from "./analysis/agent";
import { createAuditLog } from "./audit/logger";
import { Result, err, ok } from "@safeurl/core";
import { scanResultSchema } from "@safeurl/core";

// ============================================================================
// Configuration
// ============================================================================

interface FetcherConfig {
  jobId: string;
  url: string;
  fetchTimeoutMs: number;
  maxRedirectDepth: number;
}

/**
 * Parse command-line arguments and environment variables
 */
function parseConfig(): Result<FetcherConfig, string> {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  const argMap: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    const value = args[i + 1];
    if (key && value) {
      argMap[key] = value;
    }
  }

  // Get values from args or environment variables
  const jobId = argMap.jobId || argMap["job-id"] || process.env.JOB_ID;
  const url = argMap.url || process.env.SCAN_URL;
  const fetchTimeoutMs = parseInt(
    argMap["fetch-timeout-ms"] || process.env.FETCH_TIMEOUT_MS || "30000",
    10
  );
  const maxRedirectDepth = parseInt(
    argMap["max-redirect-depth"] || process.env.MAX_REDIRECT_DEPTH || "5",
    10
  );

  if (!jobId) {
    return err("Missing required parameter: job-id (JOB_ID)");
  }

  if (!url) {
    return err("Missing required parameter: url (SCAN_URL)");
  }

  if (isNaN(fetchTimeoutMs) || fetchTimeoutMs <= 0) {
    return err("Invalid fetch-timeout-ms: must be a positive number");
  }

  if (isNaN(maxRedirectDepth) || maxRedirectDepth < 0) {
    return err("Invalid max-redirect-depth: must be a non-negative number");
  }

  return ok({
    jobId,
    url,
    fetchTimeoutMs,
    maxRedirectDepth,
  });
}

/**
 * Main execution function
 */
async function main() {
  // Parse configuration
  const configResult = parseConfig();
  if (configResult.isErr()) {
    console.error(JSON.stringify({ error: configResult.error }));
    process.exit(1);
  }

  const config = configResult.value;

  try {
    // Step 1: Fetch URL safely
    const fetchResult = await fetchUrl(config.url, {
      timeoutMs: config.fetchTimeoutMs,
      maxRedirectDepth: config.maxRedirectDepth,
    });

    if (fetchResult.isErr()) {
      const error = fetchResult.error;
      const output = {
        jobId: config.jobId,
        success: false,
        error: {
          type: error.type,
          message: error.message,
        },
      };
      console.log(JSON.stringify(output));
      process.exit(error.type === "timeout" ? 2 : 1);
    }

    const fetchData = fetchResult.value;

    // Step 2: Analyze with Mastra agent
    const analysisResult = await analyzeWithAgent({
      url: config.url,
      contentHash: fetchData.contentHash,
      httpStatus: fetchData.httpStatus,
      httpHeaders: fetchData.httpHeaders,
      contentType: fetchData.contentType,
      metadata: fetchData.metadata,
    });

    if (analysisResult.isErr()) {
      const error = analysisResult.error;
      const output = {
        jobId: config.jobId,
        success: false,
        error: {
          type: error.type,
          message: error.message,
        },
      };
      console.log(JSON.stringify(output));
      process.exit(1);
    }

    const analysis = analysisResult.value;

    // Step 3: Create audit log entry
    const auditLogResult = await createAuditLog({
      scanJobId: config.jobId,
      urlAccessed: config.url,
      contentHash: fetchData.contentHash,
      httpStatus: fetchData.httpStatus,
      httpHeaders: fetchData.httpHeaders,
      contentType: fetchData.contentType,
      riskAssessmentSummary: {
        riskScore: analysis.riskScore,
        categories: analysis.categories,
        confidenceScore: analysis.confidenceScore,
      },
    });

    // Audit log failure is non-fatal, but we should log it
    if (auditLogResult.isErr()) {
      console.error(
        JSON.stringify({
          warning: "Audit log creation failed",
          error: auditLogResult.error,
        })
      );
    }

    // Step 4: Format and output result
    const result = {
      jobId: config.jobId,
      success: true,
      result: {
        riskScore: analysis.riskScore,
        categories: analysis.categories,
        confidenceScore: analysis.confidenceScore,
        reasoning: analysis.reasoning,
        indicators: analysis.indicators,
        contentHash: fetchData.contentHash,
        httpStatus: fetchData.httpStatus,
        httpHeaders: fetchData.httpHeaders,
        contentType: fetchData.contentType,
        modelUsed: analysis.modelUsed || "unknown",
        analysisMetadata: analysis.analysisMetadata,
      },
    };

    // Validate result against schema
    const validation = scanResultSchema.safeParse(result.result);
    if (!validation.success) {
      console.error(
        JSON.stringify({
          error: "Result validation failed",
          details: validation.error,
        })
      );
      process.exit(1);
    }

    // Output JSON to stdout
    console.log(JSON.stringify(result));

    // Exit successfully
    process.exit(0);
  } catch (error) {
    // Unexpected error
    const output = {
      jobId: config.jobId,
      success: false,
      error: {
        type: "unexpected",
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
    };
    console.error(JSON.stringify(output));
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  console.error(JSON.stringify({ error: error.message }));
  process.exit(1);
});
