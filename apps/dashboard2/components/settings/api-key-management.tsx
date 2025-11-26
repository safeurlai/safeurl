"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";

export function ApiKeyManagement() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription>
          Manage your API keys for programmatic access
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">
          <p>API key management coming soon.</p>
          <p className="text-sm mt-2">
            This feature will allow you to create and manage API keys for
            programmatic access to the SafeURL API.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
