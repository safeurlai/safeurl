import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { createLogger } from "@safeurl/core/logger";
import {
  transitionToFetching,
  transitionToFailed,
  getJobWithVersion,
} from "../state/transitions";
import { spawnFetcherContainer } from "../container/manager";
import { processScanResults } from "../process/results";

/**
 * Job payload structure
 */
interface ScanJobPayload {
  jobId: string;
  url: string;
  userId: string;
}

/**
 * Create Redis connection for BullMQ
 */
function createRedisConnection(): Redis {
  return new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  });
}

/**
 * Create BullMQ worker for processing scan jobs
 */
export function createWorker(): Worker<ScanJobPayload> {
  const connection = createRedisConnection();
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "5", 10);
  const logger = createLogger({ prefix: "worker" });

  const worker = new Worker<ScanJobPayload>(
    "scan-jobs",
    async (job: Job<ScanJobPayload>) => {
      const { jobId, url } = job.data;

      logger.info(`Processing scan job ${jobId} for URL: ${url}`, {
        jobId,
        url,
      });

      // Step 1: Claim job and transition QUEUED -> FETCHING
      const jobVersionResult = await getJobWithVersion(jobId);
      if (jobVersionResult.isErr()) {
        throw new Error(`Failed to get job: ${jobVersionResult.error.message}`);
      }

      const { version } = jobVersionResult.value;

      const transitionResult = await transitionToFetching(jobId, version);
      if (transitionResult.isErr()) {
        // Handle version conflicts - job might have been claimed by another worker
        if (transitionResult.error.type === "version_conflict") {
          throw new Error(`Job ${jobId} was already claimed by another worker`);
        }
        throw new Error(
          `Failed to transition to FETCHING: ${transitionResult.error.message}`
        );
      }

      // Step 2: Spawn fetcher container
      const containerResult = await spawnFetcherContainer(jobId, url);
      if (containerResult.isErr()) {
        const containerError = containerResult.error;

        // Log detailed error information for debugging
        logger.error(`Job ${jobId} - Container execution failed`, {
          error: new Error(containerError.message),
          errorType: containerError.type,
          errorMessage: containerError.message,
          details: containerError.details,
          // Extract stdout/stderr from details if available
          stdout:
            containerError.details &&
            typeof containerError.details === "object" &&
            "stdout" in containerError.details
              ? containerError.details.stdout
              : undefined,
          stderr:
            containerError.details &&
            typeof containerError.details === "object" &&
            "stderr" in containerError.details
              ? containerError.details.stderr
              : undefined,
          exitCode:
            containerError.details &&
            typeof containerError.details === "object" &&
            "exitCode" in containerError.details
              ? containerError.details.exitCode
              : undefined,
          jobId,
          url,
        });

        // Transition to FAILED state
        const updatedVersionResult = await getJobWithVersion(jobId);
        if (updatedVersionResult.isOk()) {
          await transitionToFailed(jobId, updatedVersionResult.value.version);
        }

        // Build detailed error message
        let errorMessage = `Container execution failed: ${containerError.message}`;

        // Add stdout/stderr to error message if available
        if (
          containerError.details &&
          typeof containerError.details === "object"
        ) {
          const details = containerError.details as Record<string, unknown>;
          if (
            details.stdout &&
            typeof details.stdout === "string" &&
            details.stdout.trim()
          ) {
            errorMessage += `\n\nSTDOUT:\n${details.stdout}`;
          }
          if (
            details.stderr &&
            typeof details.stderr === "string" &&
            details.stderr.trim()
          ) {
            errorMessage += `\n\nSTDERR:\n${details.stderr}`;
          }
          if (details.exitCode !== undefined) {
            errorMessage += `\n\nExit Code: ${details.exitCode}`;
          }
        }

        // Determine if this is a retryable error
        const isRetryable =
          containerError.type === "timeout" ||
          containerError.type === "docker_error";

        if (isRetryable) {
          throw new Error(errorMessage);
        } else {
          // Non-retryable errors (validation, parse errors) should fail immediately
          throw new Error(errorMessage);
        }
      }

      // Step 3: Process results (store, audit log, transition to COMPLETED)
      const processResult = await processScanResults(
        jobId,
        containerResult.value
      );
      if (processResult.isErr()) {
        // Transition to FAILED state
        const updatedVersionResult = await getJobWithVersion(jobId);
        if (updatedVersionResult.isOk()) {
          await transitionToFailed(jobId, updatedVersionResult.value.version);
        }

        throw new Error(
          `Failed to process results: ${processResult.error.message}`
        );
      }

      logger.info(`Successfully completed scan job ${jobId}`, { jobId });
      return { success: true, jobId };
    },
    {
      connection,
      concurrency,
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000, // Keep max 1000 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    }
  );

  // Set up event handlers
  worker.on("completed", (job) => {
    logger.info(`Job ${job.id} completed successfully`, { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    logger.error(`Job ${job?.id} failed`, {
      error: err,
      message: err.message,
      stack: err.stack,
      name: err.name,
      // Include job data if available
      jobData: job?.data,
      jobId: job?.id,
    });
  });

  worker.on("error", (err) => {
    logger.error("Worker error", { error: err });
  });

  return worker;
}
