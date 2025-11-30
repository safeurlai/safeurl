import {
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
} from "@tanstack/react-query";

import { api, ApiError } from "~/lib/api";
import type {
  CreateScanRequest,
  CreditBalanceResponse,
  PurchaseCreditsRequest,
  ScanResponse,
} from "~/lib/types";

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
} as const;

/**
 * Hook to set up API client
 * Kept for backwards compatibility but does nothing
 */
export function useApiSetup() {
  // No-op: API client is configured globally
}

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
  useApiSetup();

  return useQuery({
    queryKey: queryKeys.scans.detail(scanId),
    queryFn: async () => {
      const data = await api.getScan(scanId);
      return data;
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
  useApiSetup();

  return useQuery({
    queryKey: queryKeys.credits.balance(),
    queryFn: async () => {
      const data = await api.getCreditBalance();
      return data;
    },
    staleTime: 60 * 1000, // Consider data stale after 1 minute
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
  });
}

/**
 * Hook to create a new scan
 */
export function useCreateScan() {
  useApiSetup();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateScanRequest) => {
      return api.createScan(request);
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
 * Hook to purchase credits
 */
export function usePurchaseCredits() {
  useApiSetup();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: PurchaseCreditsRequest) => {
      return api.purchaseCredits(request);
    },
    onSuccess: () => {
      // Invalidate credit balance to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.credits.balance() });
    },
  });
}
