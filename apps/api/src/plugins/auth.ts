import { Elysia } from "elysia";
import { clerkPlugin } from "elysia-clerk";
import { db, wallets } from "@safeurl/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedUser } from "../types/context";

/**
 * Get or create user wallet
 * Helper function to ensure user has a wallet
 */
async function getUserWallet(clerkUserId: string): Promise<{
  userId: string;
  walletId: string;
}> {
  // Check if wallet exists
  const existingWallet = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, clerkUserId))
    .limit(1);

  if (existingWallet.length > 0) {
    return {
      userId: clerkUserId,
      walletId: existingWallet[0].id,
    };
  }

  // Wallet will be created automatically via database triggers or application logic
  // For now, return the user ID
  return {
    userId: clerkUserId,
    walletId: "", // Will be set when wallet is created
  };
}

/**
 * Validate API key and get user
 * TODO: Implement proper API key storage and lookup
 */
async function validateApiKey(
  apiKey: string
): Promise<AuthenticatedUser | null> {
  // Look up user by API key
  // Note: This assumes API keys are stored in the users table or a separate table
  // For now, this is a placeholder - you'll need to add an apiKeys table or column
  // TODO: Implement proper API key storage and lookup
  return null;
}

/**
 * Auth plugin for ElysiaJS
 * Uses elysia-clerk for Clerk authentication and adds custom user context
 * 
 * Provides:
 * - `auth()` function from elysia-clerk for auth state
 * - `clerk` client from elysia-clerk for Clerk operations
 * - `user` context with userId and clerkUserId
 * - API key authentication support (optional)
 */
export const authPlugin = new Elysia()
  .use(
    clerkPlugin({
      // Clerk plugin automatically reads CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY from env
    })
  )
  .derive(async ({ auth, headers }) => {
    // Get auth state from Clerk plugin
    const authState = auth();
    const userId = authState.userId;

    // If Clerk authentication succeeded, set up user context
    if (userId) {
      const wallet = await getUserWallet(userId);
      return {
        user: {
          userId: wallet.userId,
          clerkUserId: wallet.userId,
        } as AuthenticatedUser,
      };
    }

    // Try API key authentication as fallback
    const apiKey = headers["x-api-key"] || headers["X-API-Key"];
    if (apiKey && typeof apiKey === "string") {
      const apiKeyUser = await validateApiKey(apiKey);
      if (apiKeyUser) {
        return {
          user: apiKeyUser,
        };
      }
    }

    // No authentication provided
    return {
      authError: {
        code: "authentication_error" as const,
        message: "Authentication required",
      },
    };
  })
  .guard({
    beforeHandle: ({ user, authError, set }) => {
      if (authError || !user) {
        set.status = 401;
        return {
          error: {
            code: authError?.code || "authentication_error",
            message: authError?.message || "Authentication required",
          },
        };
      }
    },
  });
