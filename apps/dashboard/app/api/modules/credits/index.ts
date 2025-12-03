import { purchaseCreditsRequestSchema } from "@safeurl/core/schemas";
import { Elysia } from "elysia";

import { proxyRequest } from "~/lib/proxy";

/**
 * Credits module routes
 * Proxies requests to the Cloudflare Workers API
 */
export const creditsModule = new Elysia()
  .get("/credits", async ({ set }) => {
    const result = await proxyRequest("/v1/credits");

    if (!result.ok) {
      set.status = result.status;
      return result.error;
    }

    return result.data;
  })
  .post(
    "/credits/purchase",
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

