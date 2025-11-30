"use client";

import { AccountSettings } from "~/components/settings/account-settings";
import { ApiKeyManagement } from "~/components/settings/api-key-management";
import { CreditPurchase } from "~/components/settings/credit-purchase";
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
          <CreditPurchase />
        </TabsContent>

        <TabsContent value="api-keys">
          <ApiKeyManagement />
        </TabsContent>

        <TabsContent value="account">
          <AccountSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
