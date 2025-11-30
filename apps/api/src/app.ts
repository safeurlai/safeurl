import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { creditsModule } from "./modules/credits";
import { scansModule } from "./modules/scans";
import { errorHandlerPlugin } from "./plugins/error-handler";
import { openApiPlugin } from "./plugins/openapi";
import { opentelemetryPlugin } from "./plugins/opentelemetry";

/**
 * Main ElysiaJS application
 * Configures plugins and routes
 */
export const app = new Elysia()
  // Global error handler (must be first)
  .use(errorHandlerPlugin)

  // CORS configuration
  .use(
    cors({
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Request-ID"],
    }),
  )

  // OpenTelemetry observability
  .use(opentelemetryPlugin)

  // OpenAPI documentation
  .use(openApiPlugin)

  // Health check endpoint
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "safeurl-api",
    version: "1.0.0",
  }))

  // API routes with /v1 prefix
  .group("/v1", (app) => app.use(scansModule).use(creditsModule))

  // 404 handler
  .onError(({ code, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: {
          code: "not_found",
          message: "Route not found",
        },
      };
    }
  });

// Export app type for OpenAPI type generation
export type App = typeof app;
