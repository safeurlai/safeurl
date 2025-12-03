import {
  apiKeyCreationSchema,
  apiKeyListResponseSchema,
  apiKeyResponseSchema,
  createApiKeyResponseSchema,
  errorResponseSchema,
} from "@safeurl/core";
import { env } from "cloudflare:workers";
import { Elysia } from "elysia";

import { getDb } from "../../lib/db";
import { privateSubrouter } from "../../plugins/auth";
import { createApiKey, listApiKeys, revokeApiKey } from "./service";

/**
 * API Keys module routes
 */
export const apiKeysModule = privateSubrouter("/api-keys")
  .post(
    "/",
    async ({ body, set, userId }) => {
      console.log(`[POST /v1/api-keys] Request received for userId: ${userId}`);

      try {
        const db = getDb(env);
        const result = await createApiKey(db, userId, body);

        if (result.isErr()) {
          console.error(`[POST /v1/api-keys] Error:`, result.error);
          set.status = 500;
          return {
            error: {
              code: result.error.code,
              message: result.error.message,
              details:
                result.error.details &&
                typeof result.error.details === "object" &&
                !Array.isArray(result.error.details)
                  ? (result.error.details as Record<string, unknown>)
                  : undefined,
            },
            timestamp: new Date().toISOString(),
          };
        }

        const apiKey = result.value;
        set.status = 201;
        return {
          id: apiKey.id,
          key: apiKey.key,
          name: apiKey.name,
          createdAt: apiKey.createdAt.toISOString(),
        };
      } catch (error) {
        console.error(`[POST /v1/api-keys] Unexpected error:`, error);
        set.status = 500;
        return {
          error: {
            code: "internal_error",
            message:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred",
            details:
              error && typeof error === "object" && !Array.isArray(error)
                ? (error as Record<string, unknown>)
                : undefined,
          },
          timestamp: new Date().toISOString(),
        };
      }
    },
    {
      body: apiKeyCreationSchema,
      detail: {
        summary: "Create a new API key",
        description:
          "Creates a new API key for the authenticated user. The plaintext key is only returned once in this response.",
        tags: ["API Keys"],
      },
      response: {
        201: createApiKeyResponseSchema,
        500: errorResponseSchema,
      },
    },
  )
  .get(
    "/",
    async ({ set, userId }) => {
      console.log(`[GET /v1/api-keys] Request received for userId: ${userId}`);

      try {
        const db = getDb(env);
        const result = await listApiKeys(db, userId);

        if (result.isErr()) {
          console.error(`[GET /v1/api-keys] Error:`, result.error);
          set.status = 500;
          return {
            error: {
              code: result.error.code,
              message: result.error.message,
              details:
                result.error.details &&
                typeof result.error.details === "object" &&
                !Array.isArray(result.error.details)
                  ? (result.error.details as Record<string, unknown>)
                  : undefined,
            },
            timestamp: new Date().toISOString(),
          };
        }

        const keys = result.value;
        return keys.map((key) => ({
          id: key.id,
          name: key.name,
          scopes: key.scopes,
          expiresAt: key.expiresAt?.toISOString() ?? null,
          lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          createdAt: key.createdAt.toISOString(),
          revokedAt: key.revokedAt?.toISOString() ?? null,
        }));
      } catch (error) {
        console.error(`[GET /v1/api-keys] Unexpected error:`, error);
        set.status = 500;
        return {
          error: {
            code: "internal_error",
            message:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred",
            details:
              error && typeof error === "object" && !Array.isArray(error)
                ? (error as Record<string, unknown>)
                : undefined,
          },
          timestamp: new Date().toISOString(),
        };
      }
    },
    {
      detail: {
        summary: "List API keys",
        description:
          "Retrieves all API keys for the authenticated user. Plaintext keys are never returned.",
        tags: ["API Keys"],
      },
      response: {
        200: apiKeyListResponseSchema,
        500: errorResponseSchema,
      },
    },
  )
  .delete(
    "/:id",
    async ({ params, set, userId }) => {
      console.log(
        `[DELETE /v1/api-keys/:id] Request received for userId: ${userId}, keyId: ${params.id}`,
      );

      try {
        const db = getDb(env);
        const result = await revokeApiKey(db, userId, params.id);

        if (result.isErr()) {
          const error = result.error;

          if (error.code === "not_found") {
            set.status = 404;
          } else if (error.code === "already_revoked") {
            set.status = 400;
          } else {
            set.status = 500;
          }

          return {
            error: {
              code: error.code,
              message: error.message,
              details:
                error.details &&
                typeof error.details === "object" &&
                !Array.isArray(error.details)
                  ? (error.details as Record<string, unknown>)
                  : undefined,
            },
            timestamp: new Date().toISOString(),
          };
        }

        return {
          id: result.value.id,
        };
      } catch (error) {
        console.error(`[DELETE /v1/api-keys/:id] Unexpected error:`, error);
        set.status = 500;
        return {
          error: {
            code: "internal_error",
            message:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred",
            details:
              error && typeof error === "object" && !Array.isArray(error)
                ? (error as Record<string, unknown>)
                : undefined,
          },
          timestamp: new Date().toISOString(),
        };
      }
    },
    {
      params: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
        },
        required: ["id"],
      },
      detail: {
        summary: "Revoke an API key",
        description:
          "Revokes an API key by setting its revokedAt timestamp. The key will no longer be valid for authentication.",
        tags: ["API Keys"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        400: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  );
