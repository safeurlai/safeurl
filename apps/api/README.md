# SafeURL API

RESTful API service for AI-powered URL safety screening. Built with ElysiaJS, Bun, and TypeScript.

## Features

- **URL Scanning**: Create and retrieve scan jobs for URL safety analysis
- **Credit System**: Credit-based billing with balance management
- **Authentication**: Clerk OAuth2/OIDC + API key support
- **OpenAPI Docs**: Auto-generated Swagger documentation at `/openapi`
- **Observability**: OpenTelemetry tracing and distributed monitoring
- **Queue Integration**: Redis/BullMQ for async job processing

## Tech Stack

- **Runtime**: Bun
- **Framework**: ElysiaJS
- **Database**: Turso (libSQL) via Drizzle ORM
- **Queue**: Redis + BullMQ
- **Auth**: Clerk (elysia-clerk)
- **Validation**: Zod schemas from `@safeurl/core`
- **Error Handling**: neverthrow `Result<T, E>` types

## Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Build for production
bun build

# Run production build
bun start
```

Server runs on `http://localhost:8080` by default.

## API Endpoints

### Scans

- `POST /v1/scans` - Create a new URL scan job
- `GET /v1/scans/:id` - Get scan result by job ID

### Credits

- `GET /v1/credits` - Get credit balance
- `POST /v1/credits/purchase` - Purchase credits

### System

- `GET /health` - Health check
- `GET /openapi` - OpenAPI/Swagger documentation

All endpoints require authentication via Bearer token (Clerk JWT) or API key (`X-API-Key` header).

## Environment Variables

```bash
PORT=8080                          # Server port
DATABASE_URL=file:./local.db      # Turso database URL
REDIS_HOST=localhost              # Redis host
REDIS_PORT=6379                   # Redis port
REDIS_PASSWORD=                   # Redis password (optional)
CLERK_SECRET_KEY=                 # Clerk secret key
CLERK_PUBLISHABLE_KEY=            # Clerk publishable key
CORS_ORIGIN=*                     # CORS allowed origins
```

## Project Structure

```
src/
├── app.ts              # Main ElysiaJS app configuration
├── index.ts            # Server entry point
├── lib/
│   ├── db.ts          # Database client
│   └── queue.ts       # BullMQ queue setup
├── modules/
│   ├── scans/         # Scan endpoints & business logic
│   └── credits/       # Credit management endpoints
├── plugins/
│   ├── auth.ts        # Authentication plugin
│   ├── error-handler.ts
│   ├── openapi.ts     # OpenAPI documentation
│   └── opentelemetry.ts
└── types/
    └── context.ts     # TypeScript types
```

## Development

- **Hot Reload**: `bun dev` automatically reloads on file changes
- **Type Checking**: `bun run typecheck`
- **API Docs**: Visit `http://localhost:8080/openapi` for interactive Swagger UI

## Docker

```bash
# Build image
docker build -t safeurl/api -f apps/api/Dockerfile .

# Run with docker-compose
docker-compose up api
```

## Architecture

The API is stateless and horizontally scalable. It:

- Validates requests with Zod schemas
- Writes scan jobs to Turso database
- Enqueues jobs to Redis queue for worker processing
- Returns results from database queries

All operations use functional error handling with `Result<T, E>` types for explicit, type-safe error handling.
