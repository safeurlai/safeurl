"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { usePurchaseCredits } from "~/hooks/use-api";
import { useToast } from "~/hooks/use-toast";

export function CreditPurchase() {
  const [amount, setAmount] = useState(10);
  const { toast } = useToast();
  const purchaseCredits = usePurchaseCredits();

  const handlePurchase = async () => {
    try {
      const result = await purchaseCredits.mutateAsync({
        amount,
        paymentMethod: "crypto", // Stub for now
      });

      toast({
        title: "Credits purchased",
        description: `Successfully purchased ${amount} credits. New balance: ${result.newBalance}`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to purchase credits";
      toast({
        title: "Purchase failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase Credits</CardTitle>
        <CardDescription>
          Buy credits to scan URLs. Each scan costs 1 credit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Amount</label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            className="mt-1 w-full px-3 py-2 border rounded-md"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Payment Method</label>
          <select className="mt-1 w-full px-3 py-2 border rounded-md" disabled>
            <option>Crypto (Coming Soon)</option>
          </select>
        </div>
        <Button
          onClick={handlePurchase}
          disabled={purchaseCredits.isPending || amount < 1}
          className="w-full"
        >
          {purchaseCredits.isPending
            ? "Processing..."
            : `Purchase ${amount} Credits`}
        </Button>
        <p className="text-xs text-muted-foreground">
          Note: Payment integration is a stub. This will be implemented in a
          future phase.
        </p>
      </CardContent>
    </Card>
  );
}
