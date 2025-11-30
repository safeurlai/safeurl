import { cn } from "~/lib/utils";

interface RiskScoreIndicatorProps {
  riskScore: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function RiskScoreIndicator({
  riskScore,
  showLabel = true,
  size = "md",
}: RiskScoreIndicatorProps) {
  const getRiskColor = (score: number) => {
    if (score >= 70) return "bg-red-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getRiskLabel = (score: number) => {
    if (score >= 70) return "High Risk";
    if (score >= 40) return "Medium Risk";
    return "Low Risk";
  };

  const sizeClasses = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {showLabel && (
          <span className="text-sm font-medium">{getRiskLabel(riskScore)}</span>
        )}
        <span className="text-sm font-bold">{riskScore}/100</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn(
            getRiskColor(riskScore),
            sizeClasses[size],
            "transition-all duration-300 rounded-full",
          )}
          style={{ width: `${riskScore}%` }}
          role="progressbar"
          aria-valuenow={riskScore}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Risk score: ${riskScore}`}
        />
      </div>
    </div>
  );
}
