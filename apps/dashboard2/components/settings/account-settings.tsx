"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

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
              Account settings coming soon
            </p>
          </div>
        </div>
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Account management features will be available in a future update.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
