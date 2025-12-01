import type { MessageBatch, Queue } from "@cloudflare/workers-types";
import { createLogger } from "@safeurl/core/logger";
import { err, ok } from "@safeurl/core/result";
import { analyzeWithAgent } from "@safeurl/fetcher-cf/analysis/agent.js";
import { fetchUrl } from "@safeurl/fetcher-cf/fetch/url-fetcher.js";

import { createDatabase } from "./lib/db";
import { processScanResults } from "./process/results";
import {
  getJobWithVersion,
  transitionToFailed,
  transitionToFetching,
} from "./state/transitions";

const logger = createLogger({ prefix: "worker-cf" });

/**
 * Queue message structure
 */
interface QueueMessage {
  jobId: string;
  url: string;
  userId: string;
}

/**
 * Worker environment interface
 */
interface Env {
  // Queue binding (automatically provided by Cloudflare)
  SCAN_QUEUE?: Queue<QueueMessage>;
  // Browser binding for Cloudflare Playwright
  MYBROWSER?: Browser;
  // Database credentials (secrets)
  TURSO_CONNECTION_URL: string;
  TURSO_AUTH_TOKEN: string;
  // OpenRouter API key (secret)
  OPENROUTER_API_KEY: string;
  // Environment variables
  FETCH_TIMEOUT_MS?: string;
  MAX_REDIRECT_DEPTH?: string;
}

/**
 * Process a single scan job message
 */
async function processScanJob(
  message: MessageBatch<QueueMessage>["messages"][0],
  env: Env,
): Promise<void> {
  const { jobId, url } = message.body;

  logger.info("Processing scan job", {
    jobId,
    url,
    attempts: message.attempts,
  });

  // Create database connection
  const dbInstance = createDatabase({
    TURSO_CONNECTION_URL: env.TURSO_CONNECTION_URL,
    TURSO_AUTH_TOKEN: env.TURSO_AUTH_TOKEN,
  });
  const db = dbInstance.db;

  try {
    // Get current job version
    const jobVersionResult = await getJobWithVersion(db, jobId);
    if (jobVersionResult.isErr()) {
      logger.error("Failed to get job version", {
        jobId,
        error: jobVersionResult.error,
      });
      throw new Error(
        `Failed to get job version: ${jobVersionResult.error.message}`,
      );
    }

    const { version } = jobVersionResult.value;

    // Transition to FETCHING
    const transitionResult = await transitionToFetching(db, jobId, version);
    if (transitionResult.isErr()) {
      logger.error("Failed to transition to FETCHING", {
        jobId,
        error: transitionResult.error,
      });
      throw new Error(
        `Failed to transition to FETCHING: ${transitionResult.error.message}`,
      );
    }

    logger.info("Transitioned to FETCHING", { jobId });

    // Fetch URL using fetcher-cf
    const fetchTimeoutMs = parseInt(env.FETCH_TIMEOUT_MS || "30000", 10);
    const maxRedirectDepth = parseInt(env.MAX_REDIRECT_DEPTH || "5", 10);

    const fetchResult = await fetchUrl(url, {
      timeoutMs: fetchTimeoutMs,
      maxRedirectDepth,
    });

    if (fetchResult.isErr()) {
      logger.error("URL fetch failed", {
        jobId,
        url,
        error: fetchResult.error,
      });

      // Get updated version for FAILED transition
      const updatedJobVersionResult = await getJobWithVersion(db, jobId);
      if (updatedJobVersionResult.isOk()) {
        await transitionToFailed(
          db,
          jobId,
          updatedJobVersionResult.value.version,
        );
      }

      throw new Error(`Fetch failed: ${fetchResult.error.message}`);
    }

    const fetchData = fetchResult.value;
    logger.info("URL fetched successfully", {
      jobId,
      url,
      httpStatus: fetchData.httpStatus,
      contentHash: fetchData.contentHash.substring(0, 16) + "...",
    });

    // Analyze with agent using fetcher-cf
    const analysisResult = await analyzeWithAgent(
      {
        url,
        contentHash: fetchData.contentHash,
        httpStatus: fetchData.httpStatus,
        httpHeaders: fetchData.httpHeaders,
        contentType: fetchData.contentType,
        metadata: fetchData.metadata,
      },
      {
        OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
        MYBROWSER: env.MYBROWSER,
      },
    );

    if (analysisResult.isErr()) {
      logger.error("Agent analysis failed", {
        jobId,
        url,
        error: analysisResult.error,
      });

      // Get updated version for FAILED transition
      const updatedJobVersionResult = await getJobWithVersion(db, jobId);
      if (updatedJobVersionResult.isOk()) {
        await transitionToFailed(
          db,
          jobId,
          updatedJobVersionResult.value.version,
        );
      }

      throw new Error(`Analysis failed: ${analysisResult.error.message}`);
    }

    const analysis = analysisResult.value;
    logger.info("Agent analysis completed", {
      jobId,
      riskScore: analysis.riskScore,
      categories: analysis.categories,
    });

    // Process and store results
    const processResult = await processScanResults(db, jobId, {
      riskScore: analysis.riskScore,
      categories: analysis.categories,
      confidenceScore: analysis.confidenceScore,
      reasoning: analysis.reasoning,
      indicators: analysis.indicators,
      contentHash: fetchData.contentHash,
      httpStatus: fetchData.httpStatus,
      httpHeaders: fetchData.httpHeaders,
      contentType: fetchData.contentType,
      modelUsed: analysis.modelUsed,
      analysisMetadata: analysis.analysisMetadata,
    });

    if (processResult.isErr()) {
      logger.error("Failed to process scan results", {
        jobId,
        error: processResult.error,
      });

      // Get updated version for FAILED transition
      const updatedJobVersionResult = await getJobWithVersion(db, jobId);
      if (updatedJobVersionResult.isOk()) {
        await transitionToFailed(
          db,
          jobId,
          updatedJobVersionResult.value.version,
        );
      }

      throw new Error(
        `Failed to process results: ${processResult.error.message}`,
      );
    }

    logger.info("Scan job completed successfully", { jobId, url });
  } catch (error) {
    logger.error("Error processing scan job", {
      jobId,
      url,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Try to transition to FAILED if we haven't already
    try {
      const dbInstance = createDatabase({
        TURSO_CONNECTION_URL: env.TURSO_CONNECTION_URL,
        TURSO_AUTH_TOKEN: env.TURSO_AUTH_TOKEN,
      });
      const db = dbInstance.db;

      const jobVersionResult = await getJobWithVersion(db, jobId);
      if (jobVersionResult.isOk()) {
        await transitionToFailed(db, jobId, jobVersionResult.value.version);
      }
    } catch (transitionError) {
      logger.error("Failed to transition to FAILED", {
        jobId,
        error: transitionError,
      });
    }

    // Re-throw to trigger queue retry
    throw error;
  }
}

/**
 * Cloudflare Worker queue consumer handler
 */
export default {
  async queue(
    batch: MessageBatch<QueueMessage>,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    logger.info("Received queue batch", {
      batchSize: batch.messages.length,
      queue: "scan-jobs",
    });

    // Process messages individually to avoid batch failures
    for (const message of batch.messages) {
      try {
        await processScanJob(message, env);
        // Message is automatically acknowledged when handler returns successfully
      } catch (error) {
        logger.error("Message processing failed", {
          messageId: message.id,
          jobId: message.body.jobId,
          attempts: message.attempts,
          error: error instanceof Error ? error.message : String(error),
        });

        // Explicitly retry the message if we haven't exceeded max retries
        // The queue will automatically retry based on max_retries configuration
        // but we can also call message.retry() with custom delay if needed
        if (message.attempts < 3) {
          message.retry({ delaySeconds: 60 }); // Retry with 1 minute delay
        } else {
          // After max_retries, message will go to dead letter queue
          logger.error("Message exceeded max retries, will go to DLQ", {
            messageId: message.id,
            jobId: message.body.jobId,
          });
        }
      }
    }

    logger.info("Queue batch processing completed", {
      batchSize: batch.messages.length,
    });
  },
} satisfies ExportedHandler<Env>;
