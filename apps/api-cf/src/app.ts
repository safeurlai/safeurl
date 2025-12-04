import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";

import { apiKeysModule } from "./modules/api-keys";
import { scansModule } from "./modules/scans";
import { apiKeyOrClerkAuthPlugin } from "./plugins/api-key-auth";
import { errorHandlerPlugin } from "./plugins/error-handler";

/**
 * Main ElysiaJS application for Cloudflare Workers
 * Configures plugins and routes
 */
export const baseApp = new Elysia({
  adapter: CloudflareAdapter,
})
  // Global error handler (must be first)
  .use(errorHandlerPlugin)

  // CORS configuration
  .use(
    cors({
      origin: "*", // Can be configured via env vars in wrangler.jsonc
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Request-ID"],
    }),
  )

  // Health check endpoint
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "safeurl-api-cf",
    version: "1.0.0",
  }))

  // API routes with /v1 prefix
  .group("/v1", (app) =>
    app
      .use(apiKeysModule)
      // Apply API key or Clerk auth to scans and credits modules
      // This allows both API key and Clerk authentication
      .group("", (app) => app.use(apiKeyOrClerkAuthPlugin).use(scansModule)),
  )

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

// Export app type before compilation (for Eden type inference)
export type CFElysiaApp = typeof baseApp;

// Compile the app for Cloudflare Workers runtime
export const app = baseApp.compile();
