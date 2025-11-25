# SafeURL Dashboard

Next.js dashboard for SafeURL - AI-powered URL safety screening service.

## Features

- **Authentication**: Clerk-based authentication
- **Scan Management**: Create and view URL scans
- **Credit System**: View balance and purchase credits
- **Real-time Updates**: Poll for scan status updates
- **Responsive UI**: Modern, accessible interface built with shadcn/ui

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Runtime**: Bun
- **Authentication**: Clerk
- **UI**: Tailwind CSS + shadcn/ui components
- **Validation**: Zod schemas from `@safeurl/core`

## Getting Started

### Prerequisites

- Bun >= 1.0.0
- Node.js 18+ (for Next.js compatibility)

### Installation

```bash
# Install dependencies
bun install
```

### Environment Variables

Create a `.env.local` file in the `apps/dashboard` directory:

```bash
# Clerk Authentication
# Get your keys from: https://dashboard.clerk.com/last-active?path=api-keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
CLERK_SECRET_KEY=YOUR_SECRET_KEY

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8080
```

**Important**: Replace `YOUR_PUBLISHABLE_KEY` and `YOUR_SECRET_KEY` with your actual Clerk API keys from the [Clerk Dashboard](https://dashboard.clerk.com/last-active?path=api-keys). Never commit `.env.local` to version control.

### Development

```bash
# Start development server
bun dev
```

The dashboard will be available at `http://localhost:3000`.

### Build

```bash
# Build for production
bun build

# Start production server
bun start
```

## Project Structure

```
apps/dashboard/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout with Clerk provider
│   ├── page.tsx            # Dashboard home
│   ├── scans/
│   │   ├── [id]/          # Scan details page
│   │   └── new/           # New scan page
│   └── settings/          # Settings page
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── scans/            # Scan-related components
│   ├── credits/          # Credit-related components
│   ├── settings/         # Settings components
│   └── layout/           # Layout components (navbar, etc.)
├── lib/
│   ├── api.ts            # API client
│   ├── types.ts          # Type definitions
│   └── utils.ts          # Utility functions
└── hooks/                # React hooks
```

## API Integration

The dashboard communicates with the SafeURL API (`@safeurl/api`) using the API client in `lib/api.ts`. All requests are authenticated using Clerk bearer tokens.

### Available Endpoints

- `POST /v1/scans` - Create a new scan
- `GET /v1/scans/:id` - Get scan details
- `GET /v1/credits` - Get credit balance
- `POST /v1/credits/purchase` - Purchase credits

## Features in Progress

- [ ] List scans endpoint (currently placeholder)
- [ ] Real-time WebSocket updates
- [ ] API key management
- [ ] Payment integration for credits
- [ ] Scan history pagination and filtering

## Notes

- The dashboard uses Next.js Server Components where possible for better performance
- Client components are used for interactive features and real-time updates
- All API calls include proper error handling and user feedback
- The UI follows accessibility best practices with ARIA labels and keyboard navigation

