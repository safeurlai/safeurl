"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { useCreditBalance } from "~/hooks/use-api";
import { CreditCard, Plus } from "lucide-react";
import Link from "next/link";

export function CreditBalanceWidget() {
  const { data: balance, isLoading, error, refetch } = useCreditBalance();

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
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-sm text-destructive mb-2">
              {error instanceof Error
                ? error.message
                : "Failed to load credit balance"}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
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
