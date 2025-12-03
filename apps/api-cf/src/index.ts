/**
 * Cloudflare Workers entry point for SafeURL API
 * Uses Elysia with Cloudflare Workers adapter
 */

import { app } from "./app";

// Export the default handler for Cloudflare Workers
export default {
  async fetch(request: Request): Promise<Response> {
    return app.handle(request);
  },
} satisfies ExportedHandler<Env>;
