"use client";

import { useState } from "react";

import { useApiKeys, useRevokeApiKey } from "~/hooks/use-api";
import { useToast } from "~/hooks/use-toast";
import { ApiKeyList } from "./api-key-list";
import { CreateApiKeyForm } from "./create-api-key-form";
import { NewApiKeyModal } from "./new-api-key-modal";

export function ApiKeys() {
  const { toast } = useToast();
  const { data: apiKeys, isLoading, error } = useApiKeys();
  const revokeApiKey = useRevokeApiKey();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);

  const handleCreateSuccess = (key: string) => {
    setNewKey(key);
    setShowKeyModal(true);
  };

  const handleRevoke = async (keyId: string) => {
    if (
      !confirm(
        "Are you sure you want to revoke this API key? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await revokeApiKey.mutateAsync(keyId);
      toast({
        title: "API key revoked",
        description: "The API key has been revoked successfully.",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to revoke API key";
      toast({
        title: "Failed to revoke API key",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleCloseModal = () => {
    setShowKeyModal(false);
    setNewKey(null);
  };

  return (
    <div className="space-y-6">
      <CreateApiKeyForm onSuccess={handleCreateSuccess} />
      <ApiKeyList
        apiKeys={apiKeys}
        isLoading={isLoading}
        error={error}
        onRevoke={handleRevoke}
        isRevoking={revokeApiKey.isPending}
      />
      {showKeyModal && newKey && (
        <NewApiKeyModal apiKey={newKey} onClose={handleCloseModal} />
      )}
    </div>
  );
}
