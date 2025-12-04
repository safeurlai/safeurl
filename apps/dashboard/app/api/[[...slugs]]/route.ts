import { Elysia } from "elysia";

import { apiKeysModule, creditsModule, webhooksModule } from "../modules";

/**
 * Elysia server for Next.js API routes
 * Composes modules for different API endpoints:
 * - API keys: handled directly in this server
 * - Credits: handled directly in this server
 * - Scans: uses Eden treaty to call Cloudflare Workers API (requires queue operations)
 * - Checkout: Stripe Checkout session creation (authenticated)
 * - Webhooks: Stripe webhook handler (no auth, verifies Stripe signature)
 */
const app = new Elysia({ prefix: "/api" })
  // Health check
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))

  // Stripe webhooks (no auth required, but verifies Stripe signature)
  .use(webhooksModule)

  // API routes with /v1 prefix
  .group("/v1", (app) =>
    app
      // API Keys endpoints (handled directly, not proxied)
      .use(apiKeysModule)
      // Credits endpoints (handled directly, not proxied)
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
