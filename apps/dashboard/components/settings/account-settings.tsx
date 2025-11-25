"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserButton } from "@clerk/nextjs";

export function AccountSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Settings</CardTitle>
        <CardDescription>
          Manage your account profile and preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Profile</p>
            <p className="text-sm text-muted-foreground">
              Manage your profile through Clerk
            </p>
          </div>
          <UserButton />
        </div>
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Account management is handled by Clerk. Click the user button above to manage your profile, email, password, and other account settings.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

