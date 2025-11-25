"use client";

import { useEffect, useRef } from "react";
import type { ScanResponse } from "@/lib/types";

interface RealTimeUpdatesProps {
  scanId: string;
  onUpdate: (scan: ScanResponse) => void;
  pollInterval?: number;
}

/**
 * Component for polling scan status updates
 * TODO: Replace with WebSocket implementation for true real-time updates
 */
export function RealTimeUpdates({
  scanId,
  onUpdate,
  pollInterval = 5000, // Poll every 5 seconds
}: RealTimeUpdatesProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only poll if scan is in progress
    const pollScan = async () => {
      try {
        // This would call the API to get updated scan status
        // For now, it's a placeholder
        // const scan = await api.getScan(scanId);
        // onUpdate(scan);
      } catch (error) {
        console.error("Failed to poll scan status:", error);
      }
    };

    // Start polling
    intervalRef.current = setInterval(pollScan, pollInterval);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [scanId, pollInterval, onUpdate]);

  return null; // This component doesn't render anything
}

