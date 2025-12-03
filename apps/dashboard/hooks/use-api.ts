import {
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
} from "@tanstack/react-query";

import { api } from "~/lib/eden";
import type {
  ApiKeyCreation,
  ApiKeyListResponse,
  CreateApiKeyResponse,
  CreateScanRequest,
  CreditBalanceResponse,
  ScanResponse,
} from "~/lib/types";

/**
 * API error class for Eden error handling
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Query keys factory for consistent cache key management
 */
export const queryKeys = {
  scans: {
    all: ["scans"] as const,
    detail: (id: string) => ["scans", id] as const,
    list: () => ["scans", "list"] as const,
  },
  credits: {
    balance: () => ["credits", "balance"] as const,
  },
  apiKeys: {
    all: () => ["apiKeys"] as const,
    list: () => ["apiKeys", "list"] as const,
  },
} as const;

/**
 * Hook to fetch a single scan by ID
 */
export function useScan(
  scanId: string,
  options?: {
    enabled?: boolean;
    refetchInterval?:
      | number
      | false
      | ((query: Query<ScanResponse>) => number | false);
  },
) {
  return useQuery({
    queryKey: queryKeys.scans.detail(scanId),
    queryFn: async () => {
      const { data, error } = await api.v1.scans({ id: scanId }).get();
      if (error) {
        const errorData =
          typeof error.value === "string"
            ? JSON.parse(error.value)
            : error.value;
        throw new ApiError(
          errorData?.error?.code || "unknown_error",
          errorData?.error?.message || "An error occurred",
          errorData?.error?.details,
        );
      }
      if (!data) {
        throw new ApiError("not_found", "Scan not found");
      }
      return data as ScanResponse;
    },
    enabled: options?.enabled !== false && !!scanId,
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    refetchInterval: options?.refetchInterval,
    retry: (failureCount, error) => {
      // Don't retry on 404 errors
      if (error instanceof ApiError && error.code === "not_found") {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Hook to fetch credit balance
 */
export function useCreditBalance() {
  return useQuery({
    queryKey: queryKeys.credits.balance(),
    queryFn: async () => {
      const { data, error } = await api.v1.credits.get();
      if (error) {
        const errorData =
          typeof error.value === "string"
            ? JSON.parse(error.value)
            : error.value;
        throw new ApiError(
          errorData?.error?.code || "unknown_error",
          errorData?.error?.message || "An error occurred",
          errorData?.error?.details,
        );
      }
      if (!data) {
        throw new ApiError("unknown_error", "Failed to fetch credit balance");
      }
      return data as CreditBalanceResponse;
    },
    staleTime: 60 * 1000, // Consider data stale after 1 minute
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
  });
}

/**
 * Hook to create a new scan
 */
export function useCreateScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateScanRequest) => {
      const { data, error } = await api.v1.scans.post(request);
      if (error) {
        const errorData =
          typeof error.value === "string"
            ? JSON.parse(error.value)
            : error.value;
        throw new ApiError(
          errorData?.error?.code || "unknown_error",
          errorData?.error?.message || "An error occurred",
          errorData?.error?.details,
        );
      }
      if (!data) {
        throw new ApiError("unknown_error", "Failed to create scan");
      }
      return data as { id: string; state: string };
    },
    onSuccess: (data) => {
      // Invalidate scans list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.scans.list() });
      // Optionally prefetch the new scan
      queryClient.setQueryData(queryKeys.scans.detail(data.id), {
        id: data.id,
        state: data.state,
      });
    },
  });
}

/**
 * Hook to fetch user's API keys
 */
export function useApiKeys() {
  return useQuery({
    queryKey: queryKeys.apiKeys.list(),
    queryFn: async () => {
      const { data, error } = await api.v1["api-keys"].get();
      if (error) {
        const errorData =
          typeof error.value === "string"
            ? JSON.parse(error.value)
            : error.value;
        throw new ApiError(
          errorData?.error?.code || "unknown_error",
          errorData?.error?.message || "An error occurred",
          errorData?.error?.details,
        );
      }
      if (!data) {
        throw new ApiError("unknown_error", "Failed to fetch API keys");
      }
      return data as ApiKeyListResponse;
    },
    staleTime: 60 * 1000, // Consider data stale after 1 minute
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
  });
}

/**
 * Hook to create a new API key
 */
export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: ApiKeyCreation) => {
      const { data, error } = await api.v1["api-keys"].post({
        name: request.name,
        scopes: request.scopes,
        expiresAt: request.expiresAt || undefined,
        amount: 0,
        paymentMethod: "stripe",
        paymentDetails: {},
      });
      if (error) {
        const errorData =
          typeof error.value === "string"
            ? JSON.parse(error.value)
            : error.value;
        throw new ApiError(
          errorData?.error?.code || "unknown_error",
          errorData?.error?.message || "An error occurred",
          errorData?.error?.details,
        );
      }
      if (!data) {
        throw new ApiError("unknown_error", "Failed to create API key");
      }
      return data as CreateApiKeyResponse;
    },
    onSuccess: () => {
      // Invalidate API keys list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.list() });
    },
  });
}

/**
 * Hook to revoke an API key
 */
export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyId: string) => {
      const { data, error } = await api.v1["api-keys"]({ id: keyId }).delete();
      if (error) {
        const errorData =
          typeof error.value === "string"
            ? JSON.parse(error.value)
            : error.value;
        throw new ApiError(
          errorData?.error?.code || "unknown_error",
          errorData?.error?.message || "An error occurred",
          errorData?.error?.details,
        );
      }
      if (!data) {
        throw new ApiError("unknown_error", "Failed to revoke API key");
      }
      return data as { id: string };
    },
    onSuccess: () => {
      // Invalidate API keys list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.list() });
    },
  });
}
