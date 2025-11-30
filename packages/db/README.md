# @safeurl/db

Centralized database package for the SafeURL monorepo. All database access across all services (API, Worker, Dashboard) must use this package.

## Overview

This package provides:

- **Single source of truth** for database access
- **Turso/libSQL** database client (supports both local SQLite and Turso Cloud)
- **Drizzle ORM** schema definitions
- **Type-safe** database operations
- **Shared connection** across all services

## Usage

### Import Database Instance

```typescript
import { db } from "@safeurl/db";
```

### Import Schemas

```typescript
import { auditLogs, scanJobs, scanResults, users, wallets } from "@safeurl/db";
```

### Import Utilities

```typescript
import { executeRawSQL, executeRawSQLString } from "@safeurl/db";
```

### Example Usage

```typescript
import { db, scanJobs, users, eq } from "@safeurl/db";
import { drizzle-orm } from "drizzle-orm";

// Query scan jobs
const jobs = await db
  .select()
  .from(scanJobs)
  .where(eq(scanJobs.state, "QUEUED"))
  .limit(10);

// Insert user
await db.insert(users).values({
  clerkUserId: "user_123",
});

// Update with transaction
await db.transaction(async (tx) => {
  await tx.insert(scanJobs).values({...});
  await tx.update(wallets).set({...});
});
```

## Configuration

The database is configured via environment variables:

- `TURSO_CONNECTION_URL`: Database connection URL
  - Local: `file:./local.db`
  - Turso Cloud: `libsql://your-database.turso.io`
- `TURSO_AUTH_TOKEN`: Authentication token (required for Turso Cloud)

## Architecture

```
┌─────────────┐
│   Services  │
│ (API/Worker)│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ @safeurl/db │
│   Package   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Turso     │
│  (libSQL)   │
└─────────────┘
```

## Key Principles

1. **Single Database Instance**: All services share the same database connection
2. **Centralized Schema**: All table definitions live in this package
3. **Type Safety**: Full TypeScript support with Drizzle ORM
4. **Turso First**: Designed for Turso/libSQL (works with local SQLite for dev)

## Migration

Run migrations from this package:

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations
bun run db:migrate

# Push schema directly (dev only)
bun run db:push

# Open Drizzle Studio
bun run db:studio
```

## Schema Structure

- `users`: User accounts
- `wallets`: User credit balances
- `scan_jobs`: URL scan job queue
- `scan_results`: Completed scan results
- `audit_logs`: Audit trail of all scans

## Important Notes

⚠️ **DO NOT** create database clients directly in services. Always use `@safeurl/db`.

❌ **Wrong:**

```typescript
import { createClient } from "@libsql/client";
const client = createClient({...});
```

✅ **Correct:**

```typescript
import { db } from "@safeurl/db";

// Use db directly
```

## Development

### Local Development

For local development, use SQLite:

```bash
export TURSO_CONNECTION_URL="file:./local.db"
```

### Production

For production, use Turso Cloud:

```bash
export TURSO_CONNECTION_URL="libsql://your-database.turso.io"
export TURSO_AUTH_TOKEN="your-auth-token"
```

## Testing

Tests should use the same `@safeurl/db` package:

```typescript
import { db, scanJobs } from "@safeurl/db";

test("my test", async () => {
  const jobs = await db.select().from(scanJobs);
  // ...
});
```
