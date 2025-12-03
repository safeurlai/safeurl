import { treaty } from "@elysiajs/eden";
import type { App } from "@safeurl/api-cf";

/**
 * Get the API base URL for the Cloudflare Workers API
 * In development, uses localhost:8787 (Wrangler default)
 * In production, uses the deployed Cloudflare Workers URL
 */
function getBaseUrl() {
  // Use environment variable if set (highest priority)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // In browser, check for public env var or use production URL
  if (typeof window !== "undefined") {
    return (
      process.env.NEXT_PUBLIC_CF_API_URL ||
      "https://api-cf.alanrsoares.workers.dev"
    );
  }

  // Server-side: use production URL by default, or localhost in development
  return (
    process.env.CF_API_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:8787"
      : "https://api-cf.alanrsoares.workers.dev")
  );
}

/**
 * Eden Treaty client for type-safe API calls
 * Provides end-to-end type safety with the Elysia server
 * Connects to the Cloudflare Workers API (api-cf)
 */
export const api = treaty<App>(getBaseUrl()).api;
