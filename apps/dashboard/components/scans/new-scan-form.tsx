"use client";

import { useForm } from "@tanstack/react-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useCreateScan } from "~/hooks/use-api";
import { useToast } from "~/hooks/use-toast";

const urlSchema = z
  .string()
  .url("Invalid URL format")
  .min(1, "URL is required");

export function NewScanForm() {
  const router = useRouter();
  const { toast } = useToast();
  const createScan = useCreateScan();

  const form = useForm({
    defaultValues: {
      url: "",
    },
    onSubmit: async ({ value }) => {
      try {
        const result = await createScan.mutateAsync({ url: value.url });

        toast({
          title: "Scan created",
          description: "Your scan has been queued successfully.",
        });

        router.push(`/scans/${result.id}`);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An unexpected error occurred";
        toast({
          title: "Failed to create scan",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Scan</h1>
          <p className="text-muted-foreground mt-1">
            Scan a URL for safety and security risks
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Scan URL</CardTitle>
            <CardDescription>
              Enter a URL to analyze for safety and security risks. Each scan
              costs 1 credit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
              className="space-y-4"
            >
              <form.Field
                name="url"
                validators={{
                  onChange: ({ value }) => {
                    const result = urlSchema.safeParse(value);
                    return result.success
                      ? undefined
                      : result.error.errors[0]?.message;
                  },
                }}
              >
                {(field) => (
                  <div>
                    <label htmlFor={field.name} className="text-sm font-medium">
                      URL
                    </label>
                    <input
                      id={field.name}
                      name={field.name}
                      type="url"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="https://example.com"
                      className="mt-1 w-full px-3 py-2 border rounded-md"
                      disabled={createScan.isPending}
                    />
                    {field.state.meta.isTouched &&
                      field.state.meta.errors.length > 0 && (
                        <p className="mt-1 text-sm text-destructive">
                          {field.state.meta.errors[0]}
                        </p>
                      )}
                  </div>
                )}
              </form.Field>

              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    disabled={
                      !canSubmit || isSubmitting || createScan.isPending
                    }
                    className="w-full"
                  >
                    {isSubmitting || createScan.isPending
                      ? "Creating scan..."
                      : "Create Scan"}
                  </Button>
                )}
              </form.Subscribe>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
