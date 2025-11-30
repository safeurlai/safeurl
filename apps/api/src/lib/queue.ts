import { Queue, QueueOptions } from "bullmq";
import Redis from "ioredis";

/**
 * Redis connection for BullMQ
 */
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

/**
 * Queue options for BullMQ
 */
const queueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

/**
 * Scan jobs queue
 * Processes URL scan jobs
 */
export const scanQueue = new Queue("scan-jobs", queueOptions);

/**
 * Gracefully close queue connections
 */
export async function closeQueueConnections(): Promise<void> {
  await scanQueue.close();
  await redisConnection.quit();
}
