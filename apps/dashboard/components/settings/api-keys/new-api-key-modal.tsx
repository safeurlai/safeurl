"use client";

import { Copy } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useToast } from "~/hooks/use-toast";

interface NewApiKeyModalProps {
  apiKey: string;
  onClose: () => void;
}

export function NewApiKeyModal({ apiKey, onClose }: NewApiKeyModalProps) {
  const { toast } = useToast();

  const handleCopyKey = async () => {
    await navigator.clipboard.writeText(apiKey);
    toast({
      title: "Copied to clipboard",
      description: "API key has been copied to your clipboard.",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle>API Key Created</CardTitle>
          <CardDescription>
            Copy your API key now. You won&apos;t be able to see it again!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-md font-mono text-sm break-all">
            {apiKey}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCopyKey} className="flex-1">
              <Copy className="mr-2 h-4 w-4" />
              Copy to Clipboard
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
