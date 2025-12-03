import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * Stripe.js singleton pattern
 * Ensures we only load Stripe once and reuse the instance
 */
let stripePromise: Promise<Stripe | null>;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      throw new Error(
        "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set in environment variables",
      );
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}
