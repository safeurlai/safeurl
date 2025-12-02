# SafeURL API - Cloudflare Workers

This is the Cloudflare Workers port of the SafeURL API, using ElysiaJS with the Cloudflare Workers adapter.

## Overview

This API provides the same functionality as the original `@api` but runs on Cloudflare Workers, leveraging:

- **ElysiaJS** with Cloudflare Workers adapter for routing
- **Cloudflare Queues** instead of BullMQ/Redis for job processing
- **Turso/libSQL** database (via `@safeurl/db`) - will be migrated to Cloudflare D1 in the future
- **Cloudflare Workers runtime** for edge computing

## Architecture

```
┌─────────────────┐
│  Cloudflare     │
│  Workers        │
└────────┬────────┘
         │
         ├──► ElysiaJS Router
         │    ├──► /health
         │    └──► /v1
         │         ├──► /scans
         │         └──► /credits
         │
         ├──► Cloudflare Queue (SCAN_QUEUE)
         │    └──► Sends jobs to queue consumer worker
         │
         └──► Turso Database (via @safeurl/db)
              └──► Users, Wallets, Scan Jobs, Results
```

## Setup

### Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account

### Installation

```bash
# Install dependencies
bun install

# Or with npm
npm install
```

### Configuration

1. **Set up Cloudflare secrets** (for Turso connection):

   ```bash
   wrangler secret put TURSO_CONNECTION_URL
   wrangler secret put TURSO_AUTH_TOKEN
   ```

2. **Create the scan-jobs queue** (if not already created):

   ```bash
   wrangler queues create scan-jobs
   ```

3. **Update `wrangler.jsonc`** with your queue name if different from `scan-jobs`.

### Development

```bash
# Start development server
bun run dev
# or
npm run dev
```

The API will be available at `http://localhost:8787`.

### Deployment

```bash
# Deploy to Cloudflare Workers
bun run deploy
# or
npm run deploy
```

## API Endpoints

### Health Check

- `GET /health` - Returns API status

### Scans

- `POST /v1/scans` - Create a new URL scan job
- `GET /v1/scans/:id` - Get scan result by job ID

### Credits

- `GET /v1/credits` - Get user's credit balance
- `POST /v1/credits/purchase` - Purchase credits

## Differences from Original API

1. **Framework**: Uses ElysiaJS with Cloudflare Workers adapter instead of standalone ElysiaJS
2. **Queue System**: Uses Cloudflare Queues instead of BullMQ/Redis
3. **Database**: Still uses Turso (via `@safeurl/db`), but ready for migration to Cloudflare D1
4. **OpenAPI**: OpenAPI plugin is not included (not supported in Cloudflare Workers)
5. **OpenTelemetry**: OpenTelemetry plugin is not included (use Cloudflare's built-in observability)

## Environment Variables

Set these as Cloudflare secrets:

- `TURSO_CONNECTION_URL` - Turso database connection URL
- `TURSO_AUTH_TOKEN` - Turso authentication token

Set in `wrangler.jsonc` vars:

- `CORS_ORIGIN` - CORS origin (default: "\*")

## Future Migrations

### Database Migration to D1

When ready to migrate from Turso to Cloudflare D1:

1. Export data from Turso
2. Create D1 database: `wrangler d1 create safeurl-db`
3. Import data to D1
4. Update `wrangler.jsonc` with D1 binding
5. Update `src/lib/db.ts` to use D1 instead of Turso

### Durable Objects

For stateful operations or advanced features, consider using Durable Objects:

- Session management
- Rate limiting
- Real-time features

## Project Structure

```
apps/api-cf/
├── src/
│   ├── app.ts                 # Main ElysiaJS application
│   ├── index.ts               # Cloudflare Workers entry point
│   ├── lib/
│   │   ├── db.ts              # Database connection (Turso)
│   │   └── queue.ts           # Cloudflare Queue utilities
│   ├── modules/
│   │   ├── scans/
│   │   │   ├── index.ts       # Scan routes
│   │   │   └── service.ts     # Scan business logic
│   │   └── credits/
│   │       ├── index.ts       # Credit routes
│   │       └── service.ts     # Credit business logic
│   └── plugins/
│       └── error-handler.ts   # Error handling plugin
├── wrangler.jsonc             # Cloudflare Workers configuration
└── package.json
```

## Testing

```bash
# Run tests (when implemented)
bun test
# or
npm test
```

## License

AGPL-3.0
