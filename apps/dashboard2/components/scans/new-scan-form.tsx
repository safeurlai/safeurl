"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { useCreateScan } from "~/lib/hooks/use-api";
import { useToast } from "~/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

const urlSchema = z
  .string()
  .url("Invalid URL format")
  .min(1, "URL is required");

export function NewScanForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createScan = useCreateScan();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate URL
    const validation = urlSchema.safeParse(url);
    if (!validation.success) {
      const errorMessage =
        validation.error.issues[0]?.message || "Invalid URL format";
      setError(errorMessage);
      return;
    }

    try {
      const result = await createScan.mutateAsync({ url });

      toast({
        title: "Scan created",
        description: "Your scan has been queued successfully.",
      });

      router.push(`/scans/${result.id}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      toast({
        title: "Failed to create scan",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Scan</h1>
          <p className="text-muted-foreground mt-1">
            Scan a URL for safety and security risks
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Scan URL</CardTitle>
            <CardDescription>
              Enter a URL to analyze for safety and security risks. Each scan
              costs 1 credit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="url" className="text-sm font-medium">
                  URL
                </label>
                <input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="mt-1 w-full px-3 py-2 border rounded-md"
                  disabled={createScan.isPending}
                  required
                />
                {error && (
                  <p className="mt-1 text-sm text-destructive">{error}</p>
                )}
              </div>
              <Button
                type="submit"
                disabled={createScan.isPending}
                className="w-full"
              >
                {createScan.isPending ? "Creating scan..." : "Create Scan"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
