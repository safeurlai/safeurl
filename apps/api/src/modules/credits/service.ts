import { Result, ResultAsync, ok, err } from "@safeurl/core/result";
import { wrapDbQuery } from "@safeurl/core/result";
import { db, wallets } from "@safeurl/db";
import { eq } from "drizzle-orm";
import type { PurchaseCreditsRequest } from "./schemas";

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
 */
export async function getCreditBalance(
  userId: string
): Promise<Result<{ balance: number; updatedAt: Date }, ServiceError>> {
  return wrapDbQuery(async () => {
    const userWallet = await db
      .select({
        creditBalance: wallets.creditBalance,
        updatedAt: wallets.updatedAt,
      })
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (userWallet.length === 0) {
      // Create wallet if it doesn't exist
      const [newWallet] = await db
        .insert(wallets)
        .values({
          userId,
          creditBalance: 0,
        })
        .returning();

      return ok({
        balance: newWallet.creditBalance,
        updatedAt: newWallet.updatedAt,
      });
    }

    return ok({
      balance: userWallet[0].creditBalance,
      updatedAt: userWallet[0].updatedAt,
    });
  }).andThen((result) => {
    if (result.isErr()) {
      return ResultAsync.fromSafePromise(
        Promise.resolve(err(result.error))
      );
    }
    return ResultAsync.fromSafePromise(Promise.resolve(result));
  });
}

/**
 * Purchase credits (stub implementation)
 * TODO: Integrate with payment provider
 */
export async function purchaseCredits(
  userId: string,
  request: PurchaseCreditsRequest
): Promise<Result<{ transactionId: string; newBalance: number }, ServiceError>> {
  // TODO: Process payment with payment provider
  // For now, this is a stub that directly adds credits
  
  if (request.paymentMethod === "crypto") {
    // Stub: In production, verify crypto payment transaction
    // For now, we'll just add credits (this should be removed in production)
    return wrapDbQuery(async () => {
      return await db.transaction(async (tx) => {
        // Get current balance
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
    }).andThen((result) => {
      if (result.isErr()) {
        return ResultAsync.fromSafePromise(
          Promise.resolve(err({
            code: "database_error",
            message: result.error.message,
            details: result.error,
          }))
        );
      }
      
      return ResultAsync.fromSafePromise(Promise.resolve(ok(result.value)));
    });
  }

  return err({
    code: "unsupported_payment_method",
    message: `Payment method ${request.paymentMethod} is not yet supported`,
  });
}
