import { Elysia } from "elysia";
import {
  purchaseCreditsRequestSchema,
  creditBalanceResponseSchema,
} from "./schemas";
import { getCreditBalance, purchaseCredits } from "./service";
import { authPlugin } from "../../plugins/auth";

/**
 * Credits module routes
 */
export const creditsModule = new Elysia({ prefix: "/credits" })
  .use(authPlugin)
  .get(
    "/",
    async ({ user, set }) => {
      const result = await getCreditBalance(user.clerkUserId);

      if (result.isErr()) {
        set.status = 500;
        return {
          error: {
            code: result.error.code,
            message: result.error.message,
            details: result.error.details,
          },
        };
      }

      const balance = result.value;
      return {
        balance: balance.balance,
        userId: user.clerkUserId,
        updatedAt: balance.updatedAt.toISOString(),
      };
    },
    {
      detail: {
        summary: "Get credit balance",
        description: "Retrieves the current credit balance for the authenticated user",
        tags: ["Credits"],
        security: [{ BearerAuth: [] }],
      },
      response: creditBalanceResponseSchema,
    }
  )
  .post(
    "/purchase",
    async ({ body, user, set }) => {
      const result = await purchaseCredits(user.clerkUserId, body);

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
            details: error.details,
          },
        };
      }

      const purchase = result.value;
      set.status = 201;
      return {
        id: purchase.transactionId,
        userId: user.clerkUserId,
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
        description: "Purchase credits using crypto or other payment methods. This is a stub implementation.",
        tags: ["Credits"],
        security: [{ BearerAuth: [] }],
      },
    }
  );

