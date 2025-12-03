import {
  creditBalanceResponseSchema,
  errorResponseSchema,
  purchaseCreditsRequestSchema,
  purchaseCreditsResponseSchema,
} from "@safeurl/core";
import { env } from "cloudflare:workers";

import { getDb } from "../../lib/db";
import { privateSubrouter } from "../../plugins/auth";
import { getCreditBalance, purchaseCredits } from "./service";

/**
 * Credits module routes
 */
export const creditsModule = privateSubrouter("/credits")
  .get(
    "/",
    async ({ set, userId }) => {
      console.log(`[GET /v1/credits] Request received for userId: ${userId}`);

      try {
        const db = getDb(env);
        const result = await getCreditBalance(db, userId);

        if (result.isErr()) {
          console.error(`[GET /v1/credits] Error:`, result.error);
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

        const balance = result.value;
        console.log(
          `[GET /v1/credits] Success, returning balance: ${balance.balance}`,
        );
        return {
          balance: balance.balance,
          userId: userId,
          updatedAt: balance.updatedAt.toISOString(),
        };
      } catch (error) {
        console.error(`[GET /v1/credits] Unexpected error:`, error);
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
        summary: "Get credit balance",
        description: "Retrieves the current credit balance for the user",
        tags: ["Credits"],
      },
      response: {
        200: creditBalanceResponseSchema,
        500: errorResponseSchema,
      },
    },
  )
  .post(
    "/purchase",
    async ({ body, set, userId }) => {
      console.log(
        `[POST /v1/credits/purchase] Request received for userId: ${userId}`,
      );

      const db = getDb(env);
      const result = await purchaseCredits(db, userId, body);

      if (result.isErr()) {
        const error = result.error;

        if (error.code === "unsupported_payment_method") {
          set.status = 400;
        } else if (error.code === "payment_error") {
          set.status = 402;
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

      const purchase = result.value;
      set.status = 201;
      return {
        id: purchase.transactionId,
        userId: userId,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        status: "completed",
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        newBalance: purchase.newBalance,
      };
    },
    {
      body: purchaseCreditsRequestSchema,
      detail: {
        summary: "Purchase credits",
        description:
          "Purchase credits using crypto or other payment methods. This is a stub implementation.",
        tags: ["Credits"],
      },
      response: {
        201: purchaseCreditsResponseSchema,
        400: errorResponseSchema,
        402: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  );
