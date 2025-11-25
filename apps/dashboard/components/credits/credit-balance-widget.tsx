"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { CreditBalanceResponse } from "@/lib/types";
import { CreditCard, Plus } from "lucide-react";
import Link from "next/link";

export function CreditBalanceWidget() {
  const { getToken } = useAuth();
  const [balance, setBalance] = useState<CreditBalanceResponse | null>(null);
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

  useEffect(() => {
    async function fetchBalance() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getCreditBalance();
        setBalance(data);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load credit balance");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchBalance();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Credit Balance
        </CardTitle>
        <CardDescription>Your current credit balance</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-sm text-destructive mb-2">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        ) : balance ? (
          <div className="space-y-4">
            <div>
              <div className="text-4xl font-bold">{balance.balance}</div>
              <p className="text-sm text-muted-foreground mt-1">
                credits available
              </p>
            </div>
            <Link href="/settings">
              <Button className="w-full" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Purchase Credits
              </Button>
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
