"use client";

import { useEffect } from "react";
import { useScan } from "~/lib/hooks/use-api";
import type { ScanResponse } from "~/lib/types";

interface RealTimeUpdatesProps {
  scanId: string;
  onUpdate: (scan: ScanResponse) => void;
  pollInterval?: number;
  enabled?: boolean;
}

/**
 * Component for polling scan status updates using React Query
 * Automatically polls when scan is in progress (not COMPLETED, FAILED, or TIMED_OUT)
 * TODO: Replace with WebSocket implementation for true real-time updates
 */
export function RealTimeUpdates({
  scanId,
  onUpdate,
  pollInterval = 5000, // Poll every 5 seconds
  enabled = true,
}: RealTimeUpdatesProps) {
  const { data: scan } = useScan(scanId, {
    enabled: enabled && !!scanId,
    refetchInterval: (query) => {
      const scanData = query.state.data as ScanResponse | undefined;
      // Only poll if scan is in progress
      if (
        scanData &&
        !["COMPLETED", "FAILED", "TIMED_OUT"].includes(scanData.state)
      ) {
        return pollInterval;
      }
      // Stop polling if scan is complete
      return false;
    },
  });

  useEffect(() => {
    if (scan) {
      onUpdate(scan);
    }
  }, [scan, onUpdate]);

  return null; // This component doesn't render anything
}
