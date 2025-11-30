import { opentelemetry } from "@elysiajs/opentelemetry";
import { Elysia } from "elysia";

/**
 * OpenTelemetry plugin configuration
 * Sets up distributed tracing and observability
 *
 * The plugin automatically handles:
 * - Request/response tracing
 * - Error tracking
 * - Performance monitoring
 * - Span creation for each request
 */
export const opentelemetryPlugin = new Elysia().use(
  opentelemetry({
    service: {
      name: process.env.OTEL_SERVICE_NAME || "safeurl-api",
      version: process.env.OTEL_SERVICE_VERSION || "1.0.0",
    },
  }),
);
