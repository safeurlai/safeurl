"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskScoreIndicator } from "@/components/scans/risk-score-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { ScanResponse } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, ExternalLink, Calendar, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ScanDetailsProps {
  scanId: string;
}

export function ScanDetails({ scanId }: ScanDetailsProps) {
  const { getToken } = useAuth();
  const [scan, setScan] = useState<ScanResponse | null>(null);
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
    async function fetchScan() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getScan(scanId);
        setScan(data);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load scan details");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchScan();
  }, [scanId]);

  if (loading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error || "Scan not found"}</p>
          <Link href="/">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Scan Details</h1>
          <p className="text-muted-foreground mt-1">Detailed analysis results</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Scan Info */}
          <Card>
            <CardHeader>
              <CardTitle>Scan Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">URL</label>
                <div className="flex items-center gap-2 mt-1">
                  <a
                    href={scan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {scan.url}
                  </a>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge variant={
                      scan.state === "COMPLETED" ? "success" :
                      scan.state === "FAILED" || scan.state === "TIMED_OUT" ? "danger" :
                      "warning"
                    }>
                      {scan.state}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Scan ID</label>
                  <div className="mt-1 text-sm font-mono">{scan.id}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Created
                  </label>
                  <div className="mt-1 text-sm">
                    {formatDistanceToNow(new Date(scan.createdAt), { addSuffix: true })}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Updated
                  </label>
                  <div className="mt-1 text-sm">
                    {formatDistanceToNow(new Date(scan.updatedAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk Assessment */}
          {scan.result && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Risk Assessment</CardTitle>
                  <CardDescription>Overall risk score and analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <RiskScoreIndicator riskScore={scan.result.riskScore} size="lg" />
                </CardContent>
              </Card>

              {/* Categories */}
              {scan.result.categories.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Threat Categories</CardTitle>
                    <CardDescription>Detected risk categories</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {scan.result.categories.map((category) => (
                        <Badge key={category} variant="outline" className="text-sm py-1 px-3">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Indicators */}
              {scan.result.indicators.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Detected Indicators</CardTitle>
                    <CardDescription>Specific indicators that contributed to the assessment</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-2">
                      {scan.result.indicators.map((indicator, index) => (
                        <li key={index} className="text-sm">{indicator}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Reasoning */}
              <Card>
                <CardHeader>
                  <CardTitle>Analysis Reasoning</CardTitle>
                  <CardDescription>Detailed explanation of the risk assessment</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{scan.result.reasoning}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Technical Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Technical Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">HTTP Status</label>
                      <div className="mt-1 text-sm">{scan.result.httpStatus ?? "N/A"}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Content Type</label>
                      <div className="mt-1 text-sm">{scan.result.contentType ?? "N/A"}</div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Content Hash</label>
                    <div className="mt-1 text-sm font-mono break-all">{scan.result.contentHash}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Model Used</label>
                    <div className="mt-1 text-sm">{scan.result.modelUsed}</div>
                  </div>
                  {scan.result.confidenceScore && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Confidence Score</label>
                      <div className="mt-1 text-sm">{(scan.result.confidenceScore * 100).toFixed(1)}%</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {!scan.result && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Scan is still in progress. Results will appear here when complete.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

