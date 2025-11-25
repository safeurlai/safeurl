import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskScoreIndicator } from "@/components/scans/risk-score-indicator";
import type { ScanResponse } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

interface ScanCardProps {
  scan: ScanResponse;
}

export function ScanCard({ scan }: ScanCardProps) {
  const getStateColor = (state: string) => {
    switch (state) {
      case "COMPLETED":
        return "success";
      case "FAILED":
      case "TIMED_OUT":
        return "danger";
      case "QUEUED":
      case "FETCHING":
      case "ANALYZING":
        return "warning";
      default:
        return "secondary";
    }
  };

  return (
    <Link href={`/scans/${scan.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{scan.url}</CardTitle>
              <CardDescription className="mt-1">
                {formatDistanceToNow(new Date(scan.createdAt), { addSuffix: true })}
              </CardDescription>
            </div>
            <Badge variant={getStateColor(scan.state)}>{scan.state}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {scan.result ? (
            <div className="space-y-3">
              <RiskScoreIndicator riskScore={scan.result.riskScore} />
              {scan.result.categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {scan.result.categories.slice(0, 3).map((category) => (
                    <Badge key={category} variant="outline" className="text-xs">
                      {category}
                    </Badge>
                  ))}
                  {scan.result.categories.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{scan.result.categories.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Scan in progress...
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

