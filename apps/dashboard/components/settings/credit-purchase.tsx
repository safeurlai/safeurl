"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export function CreditPurchase() {
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePurchase = async () => {
    try {
      setLoading(true);
      const result = await api.purchaseCredits({
        amount,
        paymentMethod: "crypto", // Stub for now
      });
      
      toast({
        title: "Credits purchased",
        description: `Successfully purchased ${amount} credits. New balance: ${result.newBalance}`,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Purchase failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
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
        <Button onClick={handlePurchase} disabled={loading || amount < 1} className="w-full">
          {loading ? "Processing..." : `Purchase ${amount} Credits`}
        </Button>
        <p className="text-xs text-muted-foreground">
          Note: Payment integration is a stub. This will be implemented in a future phase.
        </p>
      </CardContent>
    </Card>
  );
}

