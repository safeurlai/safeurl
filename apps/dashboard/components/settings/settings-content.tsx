"use client";

import { Suspense } from "react";

import { AccountSettings } from "~/components/settings/account-settings";
import { ApiKeys } from "~/components/settings/api-keys/api-keys";
import { CreditPurchase } from "~/components/settings/credit-purchase";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

export function SettingsContent() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account, credits, and API keys
        </p>
      </div>

      <Tabs defaultValue="credits" className="space-y-6">
        <TabsList>
          <TabsTrigger value="credits">Credits</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="credits">
          <Suspense
            fallback={
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            }
          >
            <CreditPurchase />
          </Suspense>
        </TabsContent>

        <TabsContent value="api-keys">
          <ApiKeys />
        </TabsContent>

        <TabsContent value="account">
          <AccountSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
