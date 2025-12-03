import { eq, users, wallets } from "@safeurl/db";
import { Elysia } from "elysia";
import Stripe from "stripe";

import { getDb } from "~/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

/**
 * Ensure user exists in database
 */
async function ensureUserExists(userId: string): Promise<void> {
  const db = getDb();
  try {
    await db.insert(users).values({
      clerkUserId: userId,
    });
  } catch (error) {
    // User might already exist, verify by selecting
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, userId))
      .limit(1);
    if (existing.length === 0) {
      // User doesn't exist and insert failed, re-throw
      throw error;
    }
    // User exists now, continue
  }
}

/**
 * Add credits to user's wallet
 */
async function addCreditsToWallet(
  userId: string,
  amount: number,
  transactionId: string,
): Promise<{ newBalance: number }> {
  const db = getDb();

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
          creditBalance: amount,
        })
        .returning();

      console.log(
        `Created wallet for user ${userId} with ${amount} credits (transaction: ${transactionId})`,
      );
      return {
        newBalance: newWallet.creditBalance,
      };
    }

    // Update balance
    const newBalance = wallet[0].creditBalance + amount;
    await tx
      .update(wallets)
      .set({
        creditBalance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, userId));

    console.log(
      `Updated wallet for user ${userId}: added ${amount} credits (transaction: ${transactionId})`,
    );
    return {
      newBalance,
    };
  });
}

/**
 * Process Stripe webhook event
 */
async function processWebhookEvent(
  event: Stripe.Event,
  set: { status?: number | string },
): Promise<{ received: true } | { error: string; details?: string }> {
  // Handle the event
  console.log(`✅ Webhook received: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only process if payment was successful
        if (session.payment_status === "paid") {
          const metadata = session.metadata;
          if (!metadata?.userId || !metadata?.amount) {
            console.error("Missing required metadata in checkout session");
            set.status = 400;
            return {
              error: "Missing required metadata",
            };
          }

          try {
            // Add credits directly to user's wallet
            const result = await addCreditsToWallet(
              metadata.userId,
              parseInt(metadata.amount, 10),
              session.id,
            );

            console.log(
              `✅ Successfully processed payment for ${metadata.amount} credits. New balance: ${result.newBalance}`,
            );
          } catch (error) {
            console.error("Failed to add credits after payment:", error);
            set.status = 500;
            return {
              error: "Failed to process payment",
              details: error instanceof Error ? error.message : "Unknown error",
            };
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`PaymentIntent succeeded: ${paymentIntent.id}`);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.error(
          `PaymentIntent failed: ${paymentIntent.id}`,
          paymentIntent.last_payment_error,
        );
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  } catch (error) {
    console.error("Error processing webhook:", error);
    set.status = 500;
    return {
      error:
        error instanceof Error ? error.message : "Error processing webhook",
    };
  }
}

/**
 * Webhooks module routes
 * Handles Stripe webhook events (no authentication required, but verifies Stripe signature)
 */
export const webhooksModule = new Elysia({ prefix: "/webhooks" }).post(
  "/stripe",
  async ({ set, headers, request }) => {
    const signature = headers["stripe-signature"] as string | undefined;

    if (!signature) {
      set.status = 400;
      return {
        error: "Missing stripe-signature header",
      };
    }

    // Get raw body from request (Elysia hasn't parsed it yet for this route)
    // We need to read it as text for Stripe signature verification
    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch (error) {
      set.status = 400;
      return {
        error: "Failed to read request body",
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown webhook error";
      console.error(
        `❌ Webhook signature verification failed: ${errorMessage}`,
      );
      set.status = 400;
      return {
        error: `Webhook Error: ${errorMessage}`,
      };
    }

    return await processWebhookEvent(event, set);
  },
  {
    // Disable body parsing to get raw body for Stripe signature verification
    transform: [],
    detail: {
      summary: "Stripe Webhook Handler",
      description: "Handles Stripe webhook events for payment processing",
      tags: ["Stripe", "Webhooks"],
    },
  },
);
