/**
 * Proxy utility for forwarding requests to the Cloudflare Workers API
 * Used for scans and credits endpoints that are handled by api-cf
 */

// Backend API URL - points to Cloudflare Workers API
// In development, uses localhost:8787 (Wrangler default)
// In production, uses the deployed Cloudflare Workers URL
const BACKEND_API_URL =
  process.env.BACKEND_API_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:8787"
    : "https://api-cf.alanrsoares.workers.dev");

/**
 * Helper to proxy requests to the backend API
 */
export async function proxyRequest(
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

