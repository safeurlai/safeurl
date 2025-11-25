# Phase 1: Foundation & Monorepo Setup

**Status:** Not Started  
**Dependencies:** None  
**Estimated Time:** 2-3 days

## Overview

Set up the Bun monorepo structure, initialize core packages, and configure the development environment.

---

## 1.1 Project Structure

- [ ] Initialize Bun monorepo with workspace configuration
- [ ] Create `apps/` and `packages/` directories
- [ ] Set up root `package.json` with workspace configuration
- [ ] Configure TypeScript with shared `tsconfig.json`
- [ ] Set up `.gitignore` and `.editorconfig`
- [ ] Initialize `bun.lockb`

### Root `package.json` Structure

```json
{
  "name": "safeurl",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "tilt up",
    "build": "bun run --filter='./apps/*' build",
    "test": "bun test",
    "lint": "bun run --filter='./**' lint"
  }
}
```

### TypeScript Configuration

- [ ] Create `tsconfig.json` with modern ES2022 settings
- [ ] Configure path aliases for workspace packages
- [ ] Set up strict type checking
- [ ] Configure module resolution for Bun

---

## 1.2 Core Package Foundation (`packages/core`)

- [ ] Create `@safeurl/core` package structure
- [ ] Set up `package.json` with dependencies:
  - `zod` for schema validation
  - `neverthrow` for Result types
  - TypeScript types
- [ ] Create base directory structure:
  - `schemas/` (api, scan, user subdirectories)
  - `result/` (neverthrow utilities)
  - `audit/` (audit logging)
  - `types/`, `utils/`, `libs/`, `config/`
- [ ] Set up public API exports (`index.ts`)

### Package Structure

```
packages/core/
├── package.json
├── tsconfig.json
├── schemas/
│   ├── api/
│   ├── scan/
│   ├── user/
│   └── index.ts
├── result/
│   └── index.ts
├── audit/
│   └── index.ts
├── types/
├── utils/
├── libs/
├── config/
└── index.ts
```

---

## 1.3 Database Package Foundation (`packages/db`)

- [ ] Create `@safeurl/db` package
- [ ] Install dependencies:
  - `drizzle-orm`
  - `@libsql/client` (Turso driver)
  - `drizzle-kit` for migrations
- [ ] Set up Drizzle configuration
- [ ] Create initial schema structure

### Drizzle Configuration

- [ ] Create `drizzle.config.ts`
- [ ] Configure libSQL driver
- [ ] Set up migration output directory
- [ ] Configure schema path

---

## 1.4 Development Environment

- [ ] Set up Docker Compose for local services (Redis, Turso)
- [ ] Configure Tilt for live reload
- [ ] Create `.env.example` with all required variables
- [ ] Set up local Turso database
- [ ] Configure Redis connection

### Docker Compose Setup

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  turso-local:
    # Turso local setup
```

### Environment Variables

- [ ] Clerk API keys
- [ ] Turso database URL and auth token
- [ ] Redis connection string
- [ ] LLM provider API keys
- [ ] Application secrets

### Tilt Configuration

- [ ] Create `Tiltfile` in root
- [ ] Configure service dependencies
- [ ] Set up hot reload for all apps
- [ ] Configure port forwarding

---

## Success Criteria

- [ ] Monorepo structure is set up correctly
- [ ] All workspace packages can be imported
- [ ] TypeScript compilation works across workspaces
- [ ] Docker Compose starts all services
- [ ] Tilt can start development environment
- [ ] Environment variables are documented

---

## Notes

- Start with minimal configuration and expand as needed
- Ensure all paths use workspace protocol (`workspace:*`)
- Keep TypeScript configs consistent across packages
- Document all environment variables in `.env.example`

