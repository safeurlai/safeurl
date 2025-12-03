"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useCreditBalance } from "~/hooks/use-api";
import { useToast } from "~/hooks/use-toast";

export function CreditPurchase() {
  const [amount, setAmount] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { refetch: refetchBalance } = useCreditBalance();

  // Handle redirect from Stripe Checkout
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const success = searchParams.get("success") === "true";
    const canceled = searchParams.get("canceled") === "true";

    if (!sessionId) {
      return;
    }

    if (success) {
      toast({
        title: "Payment successful",
        description: "Your credits have been added to your account.",
      });
      refetchBalance();
    } else if (canceled) {
      toast({
        title: "Payment canceled",
        description: "Your payment was canceled. No charges were made.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast, refetchBalance]);

  const handlePurchase = async () => {
    if (amount < 1) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid number of credits.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Create checkout session
      const response = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          paymentMethod: "stripe",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message || "Failed to create checkout session",
        );
      }

      // Redirect to Stripe Checkout using the session URL
      // Note: stripe.redirectToCheckout is deprecated, so we use the session URL directly
      if (!data.url) {
        throw new Error("Checkout session URL not provided");
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start checkout";
      toast({
        title: "Checkout failed",
        description: errorMessage,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase Credits</CardTitle>
        <CardDescription>
          Buy credits to scan URLs. Each scan costs 1 credit ($0.10 per credit).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Number of Credits</label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            className="mt-1 w-full px-3 py-2 border rounded-md"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Total: ${(amount * 0.1).toFixed(2)}
          </p>
        </div>
        <Button
          onClick={handlePurchase}
          disabled={isLoading || amount < 1}
          className="w-full"
        >
          {isLoading ? "Processing..." : `Purchase ${amount} Credits`}
        </Button>
        <p className="text-xs text-muted-foreground">
          Secure payment powered by Stripe. You will be redirected to complete
          your purchase.
        </p>
      </CardContent>
    </Card>
  );
}
