import type {
  ScanResponse,
  CreateScanRequest,
  CreditBalanceResponse,
  PurchaseCreditsRequest,
} from "@safeurl/core/schemas";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * API client for SafeURL backend
 * Handles authentication via Clerk tokens
 */
class ApiClient {
  private baseUrl: string;
  private getTokenFn?: () => Promise<string | null>;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set the function to get auth token (from Clerk)
   */
  setAuthTokenGetter(getTokenFn: () => Promise<string | null>): void {
    this.getTokenFn = getTokenFn;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    let token: string | null = null;

    // Get token if getTokenFn is set (client-side)
    if (this.getTokenFn) {
      token = await this.getTokenFn();
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
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

