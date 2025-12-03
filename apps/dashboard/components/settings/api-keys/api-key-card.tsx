"use client";

import { Trash2 } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { ApiKeyResponse } from "~/lib/types";
import { formatDate, isExpired } from "./utils";

interface ApiKeyCardProps {
  apiKey: ApiKeyResponse;
  onRevoke: (keyId: string) => void;
  isRevoking: boolean;
}

export function ApiKeyCard({ apiKey, onRevoke, isRevoking }: ApiKeyCardProps) {
  const maskedKey = `sk_live_${"•".repeat(32)}`;
  const expired = isExpired(apiKey.expiresAt);
  const revoked = !!apiKey.revokedAt;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{apiKey.name}</h4>
            {revoked && <Badge variant="destructive">Revoked</Badge>}
            {expired && !revoked && <Badge variant="warning">Expired</Badge>}
            {!expired && !revoked && <Badge variant="success">Active</Badge>}
          </div>
          <p className="text-sm text-muted-foreground font-mono">{maskedKey}</p>
        </div>
        {!revoked && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRevoke(apiKey.id)}
            disabled={isRevoking}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div>
          <span className="font-medium">Scopes: </span>
          {apiKey.scopes.join(", ")}
        </div>
        <div>
          <span className="font-medium">Created: </span>
          {formatDate(apiKey.createdAt)}
        </div>
        {apiKey.lastUsedAt && (
          <div>
            <span className="font-medium">Last used: </span>
            {formatDate(apiKey.lastUsedAt)}
          </div>
        )}
        {apiKey.expiresAt && (
          <div>
            <span className="font-medium">Expires: </span>
            {formatDate(apiKey.expiresAt)}
          </div>
        )}
      </div>
    </div>
  );
}
