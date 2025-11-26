import { Result, ResultAsync, ok, err } from "@safeurl/core/result";
import { wrapDbQuery, type DatabaseError } from "@safeurl/core/result";
import { db, dbInstance } from "../../lib/db";
import { wallets, users, executeRawSQL } from "@safeurl/db";
import { eq, sql } from "drizzle-orm";
import type { PurchaseCreditsRequest } from "./schemas";

/**
 * Ensure user exists in database
 * Uses INSERT OR IGNORE for atomic user creation
 */
async function ensureUserExists(userId: string): Promise<void> {
  try {
    // Try to insert user, ignore if already exists (SQLite specific)
    await executeRawSQL(
      dbInstance,
      sql`INSERT OR IGNORE INTO users (clerk_user_id) VALUES (${userId})`
    );
  } catch (error) {
    // If INSERT OR IGNORE fails, try regular insert (for non-SQLite databases)
    try {
      await db.insert(users).values({
        clerkUserId: userId,
      });
    } catch (insertError) {
      // User might already exist, verify by selecting
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.clerkUserId, userId))
        .limit(1);
      if (existing.length === 0) {
        // User doesn't exist and insert failed, re-throw
        throw insertError;
      }
      // User exists now, continue
    }
  }
}

/**
 * Service errors
 */
interface ServiceError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Get user's credit balance
 * Creates user and wallet if they don't exist
 */
export async function getCreditBalance(
  userId: string
): Promise<Result<{ balance: number; updatedAt: Date }, ServiceError>> {
  console.log(`[getCreditBalance] Starting for userId: ${userId}`);

  const resultAsync = wrapDbQuery(async () => {
    console.log(`[getCreditBalance] Ensuring user exists: ${userId}`);

    // Ensure user exists first
    await ensureUserExists(userId);

    // Check if wallet exists
    console.log(
      `[getCreditBalance] Checking wallet existence for userId: ${userId}`
    );
    let userWallet = await db
      .select({
        creditBalance: wallets.creditBalance,
        updatedAt: wallets.updatedAt,
      })
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (userWallet.length === 0) {
      console.log(
        `[getCreditBalance] Wallet not found, creating wallet for userId: ${userId}`
      );
      // Create wallet if it doesn't exist
      // Handle race condition: if another request creates the wallet between check and insert
      try {
        const [newWallet] = await db
          .insert(wallets)
          .values({
            userId,
            creditBalance: 0,
          })
          .returning();

        console.log(
          `[getCreditBalance] Wallet created successfully, balance: ${newWallet.creditBalance}`
        );
        return {
          balance: newWallet.creditBalance,
          updatedAt: newWallet.updatedAt,
        };
      } catch (error: unknown) {
        console.error(`[getCreditBalance] Error creating wallet:`, error);
        // If insert fails (e.g., unique constraint), wallet was created by another request
        // Re-check to get the wallet
        userWallet = await db
          .select({
            creditBalance: wallets.creditBalance,
            updatedAt: wallets.updatedAt,
          })
          .from(wallets)
          .where(eq(wallets.userId, userId))
          .limit(1);
        if (userWallet.length === 0) {
          console.error(
            `[getCreditBalance] Wallet still not found after retry, re-throwing error`
          );
          // If still not found, re-throw the error
          throw error;
        }
        console.log(
          `[getCreditBalance] Wallet found after retry (race condition handled)`
        );
      }
    } else {
      console.log(
        `[getCreditBalance] Wallet exists, balance: ${userWallet[0].creditBalance}`
      );
    }

    return {
      balance: userWallet[0].creditBalance,
      updatedAt: userWallet[0].updatedAt,
    };
  });

  // Await the ResultAsync and convert DatabaseError to ServiceError
  const result = await resultAsync;

  if (result.isErr()) {
    const dbError = result.error;
    console.error(`[getCreditBalance] Database error:`, dbError);
    return err({
      code: `database_${dbError.type}_error`,
      message: dbError.message || "Database error occurred",
      details: dbError,
    });
  }

  console.log(
    `[getCreditBalance] Success, returning balance: ${result.value.balance}`
  );
  return ok(result.value);
}

/**
 * Purchase credits (stub implementation)
 * TODO: Integrate with payment provider
 */
export async function purchaseCredits(
  userId: string,
  request: PurchaseCreditsRequest
): Promise<
  Result<{ transactionId: string; newBalance: number }, ServiceError>
> {
  // TODO: Process payment with payment provider
  // For now, this is a stub that directly adds credits

  if (request.paymentMethod === "crypto") {
    // Stub: In production, verify crypto payment transaction
    // For now, we'll just add credits (this should be removed in production)
    const resultAsync = wrapDbQuery(async () => {
      // Ensure user exists before transaction
      await ensureUserExists(userId);

      return await db.transaction(async (tx) => {
        // Get current balance or create wallet
        const wallet = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.userId, userId))
          .limit(1);

        if (wallet.length === 0) {
          // Create wallet if it doesn't exist
          const [newWallet] = await tx
            .insert(wallets)
            .values({
              userId,
              creditBalance: request.amount,
            })
            .returning();

          return {
            transactionId: crypto.randomUUID(),
            newBalance: newWallet.creditBalance,
          };
        }

        // Update balance
        const newBalance = wallet[0].creditBalance + request.amount;
        await tx
          .update(wallets)
          .set({
            creditBalance: newBalance,
            updatedAt: new Date(),
          })
          .where(eq(wallets.userId, userId));

        return {
          transactionId: crypto.randomUUID(),
          newBalance,
        };
      });
    });

    // Await the ResultAsync and convert DatabaseError to ServiceError
    const result = await resultAsync;

    if (result.isErr()) {
      const dbError = result.error;
      return err({
        code: `database_${dbError.type}_error`,
        message: dbError.message || "Database error occurred",
        details: dbError,
      });
    }

    return ok(result.value);
  }

  return err({
    code: "unsupported_payment_method",
    message: `Payment method ${request.paymentMethod} is not yet supported`,
  });
}
