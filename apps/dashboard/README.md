This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, install dependencies:

```bash
bun install
```

Then, set up your environment variables. Create a `.env.local` file in the root of the dashboard app with the following:

```env
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Database Configuration
TURSO_CONNECTION_URL=libsql://...
TURSO_AUTH_TOKEN=...

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Backend API URL (optional, defaults to localhost:8787 in development)
BACKEND_API_URL=http://localhost:8787
```

### Stripe Setup

1. Create a Stripe account at [https://stripe.com](https://stripe.com)
2. Get your API keys from the [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
   - Use test keys (`pk_test_...` and `sk_test_...`) for development
   - Use live keys (`pk_live_...` and `sk_live_...`) for production
3. Set up webhooks:
   - Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
   - Add endpoint: `https://your-domain.com/api/webhooks/stripe`
   - Select events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy the webhook signing secret (`whsec_...`) to `STRIPE_WEBHOOK_SECRET`

**Note:** For local development, use [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Important:** The `NEXT_PUBLIC_` prefix exposes the variable to the browser. Never use this prefix for secret keys!

Now, run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Stripe Integration

This dashboard includes Stripe Checkout integration for purchasing API credits. The integration is implemented using Elysia modules and includes:

- **Checkout Session Creation**: `/api/v1/checkout` - Creates a Stripe Checkout session (authenticated)
- **Webhook Handler**: `/api/webhooks/stripe` - Processes Stripe webhook events (verifies Stripe signature)
- **Credit Purchase Component**: Located in `components/settings/credit-purchase.tsx`

Credits are priced at $0.10 per credit. When a payment is successfully completed, credits are automatically added to the user's account via the webhook handler.

### API Routes Structure

All Stripe-related routes are handled through the Elysia server:
- Checkout routes require authentication via Clerk
- Webhook routes verify Stripe signatures (no user authentication required)
- All routes are integrated into the main Elysia app at `app/api/[[...slugs]]/route.ts`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
