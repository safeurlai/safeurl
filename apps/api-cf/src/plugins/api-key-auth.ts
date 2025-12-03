import { env } from "cloudflare:workers";
import { Elysia } from "elysia";
import { clerkPlugin } from "elysia-clerk";

import { getDb } from "../lib/db";
import { updateLastUsed, validateApiKey } from "../modules/api-keys/service";

/**
 * Plugin that supports both API key and Clerk authentication
 * Checks API key first (from Authorization: Bearer <key> header)
 * Falls back to Clerk authentication if no API key is provided
 */
export const apiKeyOrClerkAuthPlugin = new Elysia()
  .use(clerkPlugin())
  .resolve(async ({ headers, auth, set }) => {
    const authHeader = headers.authorization;

    // Check for API key authentication first
    if (authHeader?.startsWith("Bearer ")) {
      const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

      try {
        const db = getDb(env);
        const validationResult = await validateApiKey(db, apiKey);

        if (validationResult.isOk()) {
          const { userId, keyId, scopes } = validationResult.value;

          // Update last used timestamp (fire and forget)
          updateLastUsed(db, keyId).catch((error) => {
            console.error(`[apiKeyAuth] Failed to update lastUsed:`, error);
          });

          return {
            userId,
            authMethod: "api_key" as const,
            scopes,
          };
        }

        // API key validation failed, return error
        set.status = 401;
        throw {
          error: {
            code: validationResult.error.code,
            message: validationResult.error.message,
          },
        };
      } catch (error) {
        // If it's already an error object, re-throw it
        if (error && typeof error === "object" && "error" in error) {
          throw error;
        }

        // Otherwise, return generic error
        set.status = 401;
        throw {
          error: {
            code: "invalid_api_key",
            message: "Invalid API key",
          },
        };
      }
    }

    // Fallback to Clerk authentication
    const authResult = auth();
    if (!authResult.userId) {
      set.status = 401;
      throw {
        error: {
          code: "unauthorized",
          message: "Unauthorized - API key or Clerk session required",
        },
      };
    }

    return {
      userId: authResult.userId,
      authMethod: "clerk" as const,
      scopes: null, // Clerk auth doesn't have scopes
    };
  });

/**
 * Plugin that requires API key authentication only
 * Use this for endpoints that should only accept API keys
 */
export const apiKeyAuthPlugin = new Elysia().resolve(
  async ({ headers, set }) => {
    const authHeader = headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      set.status = 401;
      throw {
        error: {
          code: "missing_api_key",
          message: "API key required in Authorization header",
        },
      };
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

    try {
      const db = getDb(env);
      const validationResult = await validateApiKey(db, apiKey);

      if (validationResult.isErr()) {
        set.status = 401;
        throw {
          error: {
            code: validationResult.error.code,
            message: validationResult.error.message,
          },
        };
      }

      const { userId, keyId, scopes } = validationResult.value;

      // Update last used timestamp (fire and forget)
      updateLastUsed(db, keyId).catch((error) => {
        console.error(`[apiKeyAuth] Failed to update lastUsed:`, error);
      });

      return {
        userId,
        authMethod: "api_key" as const,
        scopes,
      };
    } catch (error) {
      // If it's already an error object, re-throw it
      if (error && typeof error === "object" && "error" in error) {
        throw error;
      }

      // Otherwise, return generic error
      set.status = 401;
      throw {
        error: {
          code: "invalid_api_key",
          message: "Invalid API key",
        },
      };
    }
  },
);
