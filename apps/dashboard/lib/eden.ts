import { treaty } from "@elysiajs/eden";

import { App } from "~/app/api/[[...slugs]]/route";

/**
 * Get the API base URL for the Next.js Elysia API
 * Uses the current origin (same domain) for API routes
 */
function getNextJsApiUrl() {
  // In browser, use current origin
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Server-side: use localhost in development, or environment variable
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
  );
}

/**
 * Get the API base URL for the Cloudflare Workers API
 * In development, uses localhost:8787 (Wrangler default)
 * In production, uses the deployed Cloudflare Workers URL
 */
function getCloudflareApiUrl() {
  // Use environment variable if set (highest priority)
  if (process.env.NEXT_PUBLIC_CF_API_URL) {
    return process.env.NEXT_PUBLIC_CF_API_URL;
  }

  // In browser, use production URL
  if (typeof window !== "undefined") {
    return "https://api-cf.alanrsoares.workers.dev";
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
 * Eden Treaty client for Next.js Elysia API routes
 * Provides end-to-end type safety with the Next.js Elysia server
 * Used for API keys, checkout, and other locally-handled endpoints
 */
export const { api } = treaty<App>(getNextJsApiUrl());

/**
 * Eden Treaty client for Cloudflare Workers API
 * Used for scans and credits endpoints that are proxied
 * @deprecated Use the main `api` client instead - all endpoints are now handled by Next.js
 */
export const cfApi = treaty<App>(getCloudflareApiUrl());
