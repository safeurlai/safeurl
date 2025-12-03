/**
 * Cloudflare Workers entry point for SafeURL API
 * Uses Elysia with Cloudflare Workers adapter
 */

import { compiledApp } from "./app";

// Export the default handler for Cloudflare Workers
export default {
  async fetch(request: Request): Promise<Response> {
    return compiledApp.handle(request);
  },
} satisfies ExportedHandler<Env>;
