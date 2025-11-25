import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { Result } from "@safeurl/core/result";
import { transitionToFetching, transitionToFailed, getJobWithVersion } from "../state/transitions";
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

  const worker = new Worker<ScanJobPayload>(
    "scan-jobs",
    async (job: Job<ScanJobPayload>) => {
      const { jobId, url } = job.data;

      console.log(`Processing scan job ${jobId} for URL: ${url}`);

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
        throw new Error(`Failed to transition to FETCHING: ${transitionResult.error.message}`);
      }

      // Step 2: Spawn fetcher container
      const containerResult = await spawnFetcherContainer(jobId, url);
      if (containerResult.isErr()) {
        // Transition to FAILED state
        const updatedVersionResult = await getJobWithVersion(jobId);
        if (updatedVersionResult.isOk()) {
          await transitionToFailed(jobId, updatedVersionResult.value.version);
        }

        // Determine if this is a retryable error
        const isRetryable = 
          containerResult.error.type === "timeout" ||
          containerResult.error.type === "docker_error";

        if (isRetryable) {
          throw new Error(`Container execution failed: ${containerResult.error.message}`);
        } else {
          // Non-retryable errors (validation, parse errors) should fail immediately
          throw new Error(`Container execution failed: ${containerResult.error.message}`);
        }
      }

      // Step 3: Process results (store, audit log, transition to COMPLETED)
      const processResult = await processScanResults(jobId, containerResult.value);
      if (processResult.isErr()) {
        // Transition to FAILED state
        const updatedVersionResult = await getJobWithVersion(jobId);
        if (updatedVersionResult.isOk()) {
          await transitionToFailed(jobId, updatedVersionResult.value.version);
        }

        throw new Error(`Failed to process results: ${processResult.error.message}`);
      }

      console.log(`Successfully completed scan job ${jobId}`);
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
    console.log(`Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("Worker error:", err);
  });

  return worker;
}

