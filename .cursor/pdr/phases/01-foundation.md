# Phase 1: Foundation & Monorepo Setup

**Status:** ✅ Completed  
**Dependencies:** None  
**Estimated Time:** 2-3 days

## Overview

Set up the Bun monorepo structure, initialize core packages, and configure the development environment.

---

## 1.1 Project Structure

- [x] Initialize Bun monorepo with workspace configuration
- [x] Create `apps/` and `packages/` directories
- [x] Set up root `package.json` with workspace configuration
- [x] Configure TypeScript with shared `tsconfig.json`
- [x] Set up `.gitignore` and `.editorconfig`
- [x] Initialize workspace structure

### Root `package.json` Structure

✅ Created with workspace configuration:

- Workspaces: `apps/*`, `packages/*`
- Scripts: dev, build, test, lint, typecheck
- Database scripts: db:generate, db:migrate, db:studio

### TypeScript Configuration

- [x] Create `tsconfig.json` with modern ES2022 settings
- [x] Configure path aliases for workspace packages (`@safeurl/core`, `@safeurl/db`)
- [x] Set up strict type checking
- [x] Configure module resolution for Bun

---

## 1.2 Core Package Foundation (`packages/core`)

- [x] Create `@safeurl/core` package structure
- [x] Set up `package.json` with dependencies:
  - `zod` for schema validation
  - `neverthrow` for Result types
  - `zod-to-json-schema` for OpenAPI integration (ElysiaJS)
- [x] Create base directory structure:
  - `schemas/` (api, scan, user subdirectories)
  - `result/` (neverthrow utilities)
  - `audit/` (audit logging)
  - `types/`, `utils/`, `config/`
- [x] Set up public API exports (`index.ts`)

### Package Structure

✅ Created:

```
packages/core/
├── package.json
├── tsconfig.json
├── src/
│   ├── schemas/
│   │   ├── api/
│   │   ├── scan/
│   │   ├── user/
│   │   └── index.ts
│   ├── result/
│   │   └── index.ts
│   ├── audit/
│   │   └── index.ts
│   ├── types/
│   ├── utils/
│   ├── config/
│   └── index.ts
```

---

## 1.3 Database Package Foundation (`packages/db`)

- [x] Create `@safeurl/db` package
- [x] Install dependencies:
  - `drizzle-orm`
  - `@libsql/client` (Turso driver)
  - `drizzle-kit` for migrations
- [x] Set up Drizzle configuration

### Drizzle Configuration

- [x] Create `drizzle.config.ts`
- [x] Configure libSQL driver
- [x] Set up migration output directory
- [x] Configure schema path

✅ Created:

```
packages/db/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
└── src/
    ├── schema/
    │   └── index.ts
    └── index.ts
```

---

## 1.4 Development Environment

- [x] Set up Docker Compose for local services (Redis)
- [x] Configure Tilt for live reload
- [x] Create `.env.example` with all required variables ✅ **CREATED**
- [x] Document Turso database setup instructions (external dependency)
- [x] Redis connection configuration documented (implementation in Phase 5)

### Docker Compose Setup

✅ Created `docker-compose.yml` with:

- Redis service (port 6379)
- Volume persistence
- Health checks

### Environment Variables

**Status:** ✅ **COMPLETE** - `.env.example` file has been created.

**Template for `.env.example`:**

```bash
# SafeURL.ai Environment Variables
# Copy this file to .env and fill in your actual values

# Database (Turso/libSQL)
# For local development, you can use a local file: file:./local.db
# For production, use your Turso database URL
TURSO_CONNECTION_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# Redis/Queue
# Local development uses Docker Compose Redis service
REDIS_URL=redis://localhost:6379

# Authentication (Clerk)
# Get these from https://dashboard.clerk.com
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# LLM Provider (Mastra)
# Use your preferred LLM provider API key
OPENAI_API_KEY=sk-...
# Or other provider keys:
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_API_KEY=...

# Application
NODE_ENV=development
LOG_LEVEL=info
API_PORT=8080

# Optional: Docker configuration for fetcher containers
DOCKER_HOST=unix:///var/run/docker.sock

# Optional: Monitoring and Observability
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

**Note:** Redis connection code will be implemented in Phase 5 when apps are created. The Docker Compose configuration is complete and ready to use.

### Tilt Configuration

- [x] Create `Tiltfile` in root
- [x] Configure Docker Compose integration
- [x] Document hot reload setup (will be implemented in Phase 5)
- [x] Document port forwarding (will be configured in Phase 5)

**Note:** Hot reload and port forwarding configurations will be added in Phase 5 when apps are created. The base Tilt configuration is complete.

---

## Success Criteria

- [x] Monorepo structure is set up correctly
- [x] All workspace packages can be imported
- [x] TypeScript compilation works across workspaces
- [x] Docker Compose starts all services
- [x] Tilt configuration is in place
- [x] Environment variables are documented (`.env.example` file created ✅)

---

## Next Steps

1. ✅ **Install dependencies**: Run `bun install` to install all workspace dependencies
2. ✅ **Set up Turso**: See `SETUP.md` for detailed instructions
3. ✅ **Create `.env` file**: Copy from `.env.example` template (see `SETUP.md`)
4. ✅ **Start Phase 2**: Begin implementing core package schemas and utilities

**Setup Guide:** See `SETUP.md` in project root for detailed setup instructions.

## Notes

- ✅ All core structure is in place
- ✅ TypeScript configuration is consistent across packages
- ✅ Workspace protocol will be used for internal dependencies
- ✅ `.env.example` file created ✅
- ✅ Setup guide created (`SETUP.md`) with step-by-step instructions
- ✅ Redis connection configuration documented (implementation in Phase 5)
- ✅ Turso setup instructions documented (external dependency)
