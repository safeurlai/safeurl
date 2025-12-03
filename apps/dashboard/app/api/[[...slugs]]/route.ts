import { Elysia } from "elysia";

import { apiKeysModule, creditsModule, scansModule } from "../modules";

/**
 * Elysia server for Next.js API routes
 * Composes modules for different API endpoints:
 * - API keys: handled directly in this server
 * - Scans & Credits: proxied to Cloudflare Workers API
 */
const app = new Elysia({ prefix: "/api" })
  // Health check
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))

  // API routes with /v1 prefix
  .group("/v1", (app) =>
    app
      // API Keys endpoints (handled directly, not proxied)
      .use(apiKeysModule)
      // Scans endpoints (proxied to Cloudflare Workers API)
      .use(scansModule)
      // Credits endpoints (proxied to Cloudflare Workers API)
      .use(creditsModule),
  );

// Export app type for Eden
export type App = typeof app;

// Export HTTP methods for Next.js route handler
export const GET = app.fetch;
export const POST = app.fetch;
export const PUT = app.fetch;
export const DELETE = app.fetch;
export const PATCH = app.fetch;
