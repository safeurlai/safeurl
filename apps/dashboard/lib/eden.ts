import { treaty } from "@elysiajs/eden";

import type { App } from "~/app/api/[[...slugs]]/route";

function getBaseUrl() {
  if (typeof window !== "undefined")
    // browser should use relative path
    return "";
  if (process.env.VERCEL_URL)
    // reference for vercel.com
    return `https://${process.env.VERCEL_URL}`;
  if (process.env.RENDER_INTERNAL_HOSTNAME)
    // reference for render.com
    return `http://${process.env.RENDER_INTERNAL_HOSTNAME}:${process.env.PORT}`;
  // assume localhost
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Eden Treaty client for type-safe API calls
 * Provides end-to-end type safety with the Elysia server
 */
export const api = treaty<App>(getBaseUrl()).api;
