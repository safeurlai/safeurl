import { createScanRequestSchema } from "@safeurl/core/schemas";

import { privateSubrouter } from "~/lib/auth";
import { proxyRequest } from "~/lib/proxy";

/**
 * Scans module routes
 * Proxies requests to the Cloudflare Workers API
 * Queue operations (publishing/reading) are handled by the backend
 */
export const scansModule = privateSubrouter("/scans")
  .post(
    "/",
    async ({ body, set, headers }) => {
      // Forward the authenticated request to the backend
      // The backend handles queue publishing
      // Forward Clerk session token from cookies
      const result = await proxyRequest("/v1/scans", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          // Forward cookies for Clerk authentication
          Cookie: headers.cookie || "",
          // Forward authorization header if present (for API keys)
          ...(headers.authorization && {
            Authorization: headers.authorization,
          }),
        },
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
  .get("/:id", async ({ params: { id }, set, headers }) => {
    // Forward the authenticated request to the backend
    const result = await proxyRequest(`/v1/scans/${id}`, {
      headers: {
        // Forward cookies for Clerk authentication
        Cookie: headers.cookie || "",
        // Forward authorization header if present (for API keys)
        ...(headers.authorization && { Authorization: headers.authorization }),
      },
    });

    if (!result.ok) {
      set.status = result.status;
      return result.error;
    }

    return result.data;
  });
