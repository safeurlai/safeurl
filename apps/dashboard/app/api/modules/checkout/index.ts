import { purchaseCreditsRequestSchema } from "@safeurl/core/schemas";
import Stripe from "stripe";
import { z } from "zod";

import { privateSubrouter } from "~/lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover",
});

const CURRENCY = "usd";

/**
 * Format amount for Stripe (convert to cents)
 */
function formatAmountForStripe(amount: number, currency: string): number {
  const numberFormat = new Intl.NumberFormat(["en-US"], {
    style: "currency",
    currency: currency,
    currencyDisplay: "symbol",
  });
  const parts = numberFormat.formatToParts(amount);
  let zeroDecimalCurrency = true;
  for (const part of parts) {
    if (part.type === "decimal") {
      zeroDecimalCurrency = false;
    }
  }
  return zeroDecimalCurrency ? Math.round(amount) : Math.round(amount * 100);
}

/**
 * Checkout module routes
 * Creates Stripe Checkout sessions for purchasing credits
 */
export const checkoutModule = privateSubrouter("/checkout")
  .post(
    "/",
    async ({ body, set, userId, headers }) => {
      try {
        // Validate that payment method is stripe
        if (body.paymentMethod !== "stripe") {
          set.status = 400;
          return {
            error: {
              code: "invalid_payment_method",
              message: "Only Stripe payment method is supported",
            },
          };
        }

        // Get the origin for success/cancel URLs
        const origin =
          headers.origin || headers.referer?.split("/").slice(0, 3).join("/") || "http://localhost:3000";

        // Create Checkout Session
        const params: Stripe.Checkout.SessionCreateParams = {
          submit_type: "pay",
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: CURRENCY,
                product_data: {
                  name: "API Credits",
                  description: `${body.amount} API Credits for URL scanning`,
                },
                unit_amount: formatAmountForStripe(
                  body.amount * 0.1, // $0.10 per credit
                  CURRENCY,
                ),
              },
              quantity: body.amount,
            },
          ],
          mode: "payment",
          success_url: `${origin}/settings?session_id={CHECKOUT_SESSION_ID}&success=true`,
          cancel_url: `${origin}/settings?session_id={CHECKOUT_SESSION_ID}&canceled=true`,
          metadata: {
            userId: userId,
            amount: body.amount.toString(),
            paymentMethod: "stripe",
          },
        };

        const checkoutSession: Stripe.Checkout.Session =
          await stripe.checkout.sessions.create(params);

        // Return both id and url - url is used for direct redirect (redirectToCheckout is deprecated)
        return { 
          id: checkoutSession.id,
          url: checkoutSession.url,
        };
      } catch (error) {
        console.error("Error creating checkout session:", error);

        if (error instanceof z.ZodError) {
          set.status = 400;
          return {
            error: {
              code: "validation_error",
              message: "Invalid request body",
              details: error.issues,
            },
          };
        }

        set.status = 500;
        return {
          error: {
            code: "checkout_error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to create checkout session",
          },
        };
      }
    },
    {
      body: purchaseCreditsRequestSchema,
      detail: {
        summary: "Create Stripe Checkout Session",
        description: "Creates a Stripe Checkout session for purchasing API credits",
        tags: ["Stripe", "Checkout"],
      },
    },
  );

