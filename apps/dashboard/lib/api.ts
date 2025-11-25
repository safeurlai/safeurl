import type {
  ScanResponse,
  CreateScanRequest,
  CreditBalanceResponse,
  PurchaseCreditsRequest,
} from "@safeurl/core/schemas";

/**
 * API client for SafeURL backend
 * Uses Next.js API proxy routes to forward requests to the backend API
 */
class ApiClient {
  /**
   * Use Next.js API proxy route instead of direct backend calls
   */
  private getProxyUrl(endpoint: string): string {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
    // Use Next.js API proxy route
    return `/api/${cleanEndpoint}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Use Next.js proxy route instead of direct backend URL
    const url = this.getProxyUrl(endpoint);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: {
            code: "unknown_error",
            message: `HTTP ${response.status}: ${response.statusText}`,
          },
        }));
        throw new ApiError(
          error.error?.code || "unknown_error",
          error.error?.message || "An error occurred",
          error.error?.details
        );
      }

      return response.json();
    } catch (error) {
      // Handle network errors (API not reachable, CORS, etc.)
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Check if it's a network error
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new ApiError(
          "network_error",
          `Failed to connect to API proxy. Please ensure the Next.js server is running.`,
          { originalError: error.message }
        );
      }
      
      // Re-throw unknown errors
      throw new ApiError(
        "unknown_error",
        error instanceof Error ? error.message : "An unexpected error occurred",
        error
      );
    }
  }

  // Scans endpoints
  async createScan(request: CreateScanRequest): Promise<{ id: string; state: string }> {
    return this.request("/v1/scans", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getScan(id: string): Promise<ScanResponse> {
    return this.request(`/v1/scans/${id}`);
  }

  // Credits endpoints
  async getCreditBalance(): Promise<CreditBalanceResponse> {
    return this.request("/v1/credits");
  }

  async purchaseCredits(request: PurchaseCreditsRequest): Promise<{
    id: string;
    userId: string;
    amount: number;
    paymentMethod: string;
    status: string;
    createdAt: string;
    completedAt: string;
    newBalance: number;
  }> {
    return this.request("/v1/credits/purchase", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }
}

/**
 * API error class
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Export singleton instance
export const api = new ApiClient();

