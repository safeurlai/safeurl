"use client";

import { Key } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { ApiKeyResponse } from "~/lib/types";
import { ApiKeyCard } from "./api-key-card";

interface ApiKeyListProps {
  apiKeys: ApiKeyResponse[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRevoke: (keyId: string) => void;
  isRevoking: boolean;
}

export function ApiKeyList({
  apiKeys,
  isLoading,
  error,
  onRevoke,
  isRevoking,
}: ApiKeyListProps) {
  const activeKeys = apiKeys?.filter((key) => !key.revokedAt) || [];
  const revokedKeys = apiKeys?.filter((key) => key.revokedAt) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your API Keys</CardTitle>
        <CardDescription>
          Manage your API keys. Revoked keys cannot be used for authentication.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Loading API keys...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-destructive mb-2">
              {error instanceof Error
                ? error.message
                : "Failed to load API keys"}
            </p>
          </div>
        ) : activeKeys.length === 0 && revokedKeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No API keys yet.</p>
            <p className="text-sm mt-2">
              Create your first API key to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeKeys.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Active Keys</h3>
                <div className="space-y-3">
                  {activeKeys.map((key) => (
                    <ApiKeyCard
                      key={key.id}
                      apiKey={key}
                      onRevoke={onRevoke}
                      isRevoking={isRevoking}
                    />
                  ))}
                </div>
              </div>
            )}

            {revokedKeys.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                  Revoked Keys
                </h3>
                <div className="space-y-3">
                  {revokedKeys.map((key) => (
                    <ApiKeyCard
                      key={key.id}
                      apiKey={key}
                      onRevoke={onRevoke}
                      isRevoking={isRevoking}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
