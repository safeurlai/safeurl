#!/usr/bin/env bun

/**
 * Worker Service Entry Point
 *
 * Processes scan jobs from the queue, manages state transitions,
 * spawns fetcher containers, and stores results.
 */
import { createWorker } from "./queue/processor";

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown(worker: ReturnType<typeof createWorker>) {
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);

    try {
      await worker.close();
      console.log("Worker closed successfully");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

/**
 * Main function
 */
async function main() {
  console.log("Starting worker service...");

  // Validate required environment variables
  const requiredEnvVars = ["TURSO_CONNECTION_URL"];
  const missingEnvVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingEnvVars.length > 0) {
    console.error(
      `Missing required environment variables: ${missingEnvVars.join(", ")}`,
    );
    process.exit(1);
  }

  // Create and start worker
  const worker = createWorker();

  // Set up graceful shutdown
  setupGracefulShutdown(worker);

  console.log("Worker service started and ready to process jobs");
  console.log(`Concurrency: ${process.env.WORKER_CONCURRENCY || "5"}`);
  console.log(
    `Fetcher image: ${process.env.FETCHER_IMAGE || "safeurl-fetcher:latest"}`,
  );
}

// Run main function
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
