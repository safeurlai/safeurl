import { createScanRequestSchema } from "@safeurl/core/schemas";
import { Elysia } from "elysia";

import { proxyRequest } from "~/lib/proxy";

/**
 * Scans module routes
 * Proxies requests to the Cloudflare Workers API
 */
export const scansModule = new Elysia()
  .post(
    "/scans",
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
  .get("/scans/:id", async ({ params: { id }, set }) => {
    const result = await proxyRequest(`/v1/scans/${id}`);

    if (!result.ok) {
      set.status = result.status;
      return result.error;
    }

    return result.data;
  });

