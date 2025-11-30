import {
  createScanRequestSchema,
  purchaseCreditsRequestSchema,
} from "@safeurl/core/schemas";
import { Elysia } from "elysia";

// Backend API URL - defaults to localhost:8080 in development
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:8080";

/**
 * Helper to proxy requests to the backend API
 */
async function proxyRequest(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; data?: unknown; error?: unknown; status: number }> {
  const url = `${BACKEND_API_URL}${path}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        error: data || {
          error: {
            code: "unknown_error",
            message: `HTTP ${response.status}: ${response.statusText}`,
          },
        },
        status: response.status,
      };
    }

    return { ok: true, data, status: response.status };
  } catch (error) {
    return {
      ok: false,
      error: {
        error: {
          code: "network_error",
          message: error instanceof Error ? error.message : "Network error",
        },
      },
      status: 500,
    };
  }
}

/**
 * Elysia server for Next.js API routes
 * Acts as a proxy/middleware layer to the backend API
 */
const app = new Elysia({ prefix: "/api" })
  // Health check
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))

  // Scans endpoints
  .post(
    "/v1/scans",
    async ({ body, set }) => {
      const result = await proxyRequest("/v1/scans", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!result.ok) {
        set.status = result.status;
        return result.error;
      }

      return result.data;
    },
    {
      body: createScanRequestSchema,
    },
  )
  .get("/v1/scans/:id", async ({ params: { id }, set }) => {
    const result = await proxyRequest(`/v1/scans/${id}`);

    if (!result.ok) {
      set.status = result.status;
      return result.error;
    }

    return result.data;
  })

  // Credits endpoints
  .get("/v1/credits", async ({ set }) => {
    const result = await proxyRequest("/v1/credits");

    if (!result.ok) {
      set.status = result.status;
      return result.error;
    }

    return result.data;
  })
  .post(
    "/v1/credits/purchase",
    async ({ body, set }) => {
      const result = await proxyRequest("/v1/credits/purchase", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!result.ok) {
        set.status = result.status;
        return result.error;
      }

      return result.data;
    },
    {
      body: purchaseCreditsRequestSchema,
    },
  );

// Export app type for Eden
export type App = typeof app;

// Export HTTP methods for Next.js route handler
export const GET = app.fetch;
export const POST = app.fetch;
export const PUT = app.fetch;
export const DELETE = app.fetch;
export const PATCH = app.fetch;
