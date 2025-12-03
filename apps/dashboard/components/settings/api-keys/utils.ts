import { format } from "date-fns";

/**
 * Format date for display
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return "Never";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy 'at' h:mm a");
}

/**
 * Check if API key is expired
 */
export function isExpired(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return false;
  const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return d < new Date();
}
