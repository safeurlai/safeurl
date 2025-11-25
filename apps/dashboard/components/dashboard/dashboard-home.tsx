"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScanCard } from "@/components/scans/scan-card";
import { CreditBalanceWidget } from "@/components/credits/credit-balance-widget";
import { api, ApiError } from "@/lib/api";
import type { ScanResponse } from "@/lib/types";
import { Plus } from "lucide-react";
import Link from "next/link";

export function DashboardHome() {
  const { getToken } = useAuth();
  const [scans, setScans] = useState<ScanResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set up auth token getter for API client
  useEffect(() => {
    if (getToken) {
      api.setAuthTokenGetter(async () => {
        try {
          return await getToken();
        } catch {
          return null;
        }
      });
    }
  }, [getToken]);

  // Note: Since we don't have a list endpoint yet, we'll show a placeholder
  // In a real implementation, you'd fetch scans here
  useEffect(() => {
    // For now, we'll just set loading to false
    // TODO: Implement list scans endpoint in API
    setLoading(false);
  }, []);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your URL scans and credits
          </p>
        </div>
        <Link href="/scans/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Scan
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Scans</CardTitle>
              <CardDescription>
                Your most recent URL safety scans
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-destructive mb-4">{error}</p>
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    Retry
                  </Button>
                </div>
              ) : scans.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    No scans yet. Start by scanning a URL!
                  </p>
                  <Link href="/scans/new">
                    <Button>Create Your First Scan</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {scans.map((scan) => (
                    <ScanCard key={scan.id} scan={scan} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <CreditBalanceWidget />
        </div>
      </div>
    </div>
  );
}

