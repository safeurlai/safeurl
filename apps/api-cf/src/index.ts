/**
 * Cloudflare Workers entry point for SafeURL API
 * Uses Elysia with Cloudflare Workers adapter
 */

import { app } from "./app";

// Compile the app for Cloudflare Workers
const compiledApp = app.compile();

// Export the default handler for Cloudflare Workers
export default {
  async fetch(request: Request): Promise<Response> {
    return compiledApp.handle(request);
  },
} satisfies ExportedHandler<Env>;
