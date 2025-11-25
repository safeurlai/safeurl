import { app } from "./app";

/**
 * API Server Entry Point
 * Starts the ElysiaJS server
 */

const PORT = parseInt(process.env.PORT || "8080", 10);

app.listen(PORT, () => {
  console.log(`🚀 SafeURL API server is running on port ${PORT}`);
  console.log(`📚 OpenAPI documentation: http://localhost:${PORT}/openapi`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  // Close queue connections if needed
  const { closeQueueConnections } = await import("./lib/queue");
  await closeQueueConnections();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  const { closeQueueConnections } = await import("./lib/queue");
  await closeQueueConnections();
  process.exit(0);
});
