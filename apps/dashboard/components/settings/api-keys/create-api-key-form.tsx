"use client";

import { useForm } from "@tanstack/react-form";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useCreateApiKey } from "~/hooks/use-api";
import { useToast } from "~/hooks/use-toast";

const apiKeyCreationSchema = z.object({
  name: z
    .string()
    .min(1, "API key name is required")
    .max(100, "API key name exceeds maximum length"),
  scopes: z
    .array(z.enum(["scan:read", "scan:write", "credits:read"]))
    .min(1, "At least one scope is required"),
  expiresAt: z.string().datetime().optional().nullable(),
});

interface CreateApiKeyFormProps {
  onSuccess: (key: string) => void;
}

export function CreateApiKeyForm({ onSuccess }: CreateApiKeyFormProps) {
  const { toast } = useToast();
  const createApiKey = useCreateApiKey();

  const form = useForm({
    defaultValues: {
      name: "",
      scopes: [] as Array<"scan:read" | "scan:write" | "credits:read">,
      expiresAt: null as string | null,
    },
    onSubmit: async ({ value }) => {
      try {
        const result = await createApiKey.mutateAsync({
          name: value.name,
          scopes: value.scopes,
          expiresAt: value.expiresAt || undefined,
        });

        form.reset();
        onSuccess(result.key);

        toast({
          title: "API key created",
          description: "Your API key has been created successfully.",
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create API key";
        toast({
          title: "Failed to create API key",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create API Key</CardTitle>
        <CardDescription>
          Create a new API key for programmatic access to the SafeURL API
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
            name="name"
            validators={{
              onChange: ({ value }) => {
                const result = apiKeyCreationSchema.shape.name.safeParse(value);
                return result.success
                  ? undefined
                  : result.error.issues[0]?.message;
              },
            }}
          >
            {(field) => (
              <div>
                <label htmlFor={field.name} className="text-sm font-medium">
                  Name
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="My API Key"
                  className="mt-1 w-full px-3 py-2 border rounded-md"
                  disabled={createApiKey.isPending}
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

          <form.Field
            name="scopes"
            validators={{
              onChange: ({ value }) => {
                const result =
                  apiKeyCreationSchema.shape.scopes.safeParse(value);
                return result.success
                  ? undefined
                  : result.error.issues[0]?.message;
              },
            }}
          >
            {(field) => (
              <div>
                <label className="text-sm font-medium">Scopes</label>
                <div className="mt-2 space-y-2">
                  {(["scan:read", "scan:write", "credits:read"] as const).map(
                    (scope) => (
                      <label
                        key={scope}
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="checkbox"
                          checked={field.state.value.includes(scope)}
                          onChange={(e) => {
                            const current = field.state.value;
                            if (e.target.checked) {
                              field.handleChange([...current, scope] as Array<
                                "scan:read" | "scan:write" | "credits:read"
                              >);
                            } else {
                              field.handleChange(
                                current.filter(
                                  (s: string) => s !== scope,
                                ) as Array<
                                  "scan:read" | "scan:write" | "credits:read"
                                >,
                              );
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{scope}</span>
                      </label>
                    ),
                  )}
                </div>
                {field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0 && (
                    <p className="mt-1 text-sm text-destructive">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
              </div>
            )}
          </form.Field>

          <form.Field name="expiresAt">
            {(field) => (
              <div>
                <label htmlFor="expiresAt" className="text-sm font-medium">
                  Expiration Date (Optional)
                </label>
                <input
                  id="expiresAt"
                  type="datetime-local"
                  value={
                    field.state.value
                      ? new Date(field.state.value).toISOString().slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const value = e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null;
                    field.handleChange(value as string | null);
                  }}
                  className="mt-1 w-full px-3 py-2 border rounded-md"
                  disabled={createApiKey.isPending}
                />
              </div>
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting || createApiKey.isPending}
                className="w-full"
              >
                {isSubmitting || createApiKey.isPending
                  ? "Creating..."
                  : "Create API Key"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
