# Database Access Guidelines

## ✅ All Database Access Must Use `@safeurl/db`

**CRITICAL**: All database access across the entire monorepo must use the `@safeurl/db` package. This ensures:

- ✅ Single source of truth for database configuration
- ✅ Consistent Turso/libSQL usage across all services
- ✅ Shared database connection and schema
- ✅ Type safety with Drizzle ORM

## Correct Usage

### ✅ Import from `@safeurl/db`

```typescript
// ✅ CORRECT: Import database instance
import { db } from "@safeurl/db";

// ✅ CORRECT: Import schemas
import { scanJobs, users, wallets, scanResults, auditLogs } from "@safeurl/db";

// ✅ CORRECT: Import utilities
import { executeRawSQL, executeRawSQLString } from "@safeurl/db";

// ✅ CORRECT: Import types
import type { Database } from "@safeurl/db";
```

### Example: Querying Data

```typescript
import { db, scanJobs, eq } from "@safeurl/db";
import { drizzle-orm } from "drizzle-orm";

// Query scan jobs
const jobs = await db
  .select()
  .from(scanJobs)
  .where(eq(scanJobs.state, "QUEUED"))
  .limit(10);
```

### Example: Inserting Data

```typescript
import { db, users } from "@safeurl/db";

await db.insert(users).values({
  clerkUserId: "user_123",
});
```

### Example: Transactions

```typescript
import { db, scanJobs, wallets, eq } from "@safeurl/db";

await db.transaction(async (tx) => {
  await tx.insert(scanJobs).values({...});
  await tx.update(wallets).set({...}).where(eq(wallets.userId, "..."));
});
```

## ❌ Incorrect Usage

### ❌ DO NOT Create Database Clients Directly

```typescript
// ❌ WRONG: Don't import @libsql/client directly
import { createClient } from "@libsql/client";
const client = createClient({ url: "..." });

// ❌ WRONG: Don't create drizzle instances directly
import { drizzle } from "drizzle-orm/libsql";
const db = drizzle(client, { schema });
```

### ❌ DO NOT Use Service-Specific Database Files

```typescript
// ❌ WRONG: Don't import from service lib/db.ts
import { db } from "../../lib/db";

// ✅ CORRECT: Import directly from @safeurl/db
import { db } from "@safeurl/db";
```

## Package Structure

The `@safeurl/db` package provides:

```
@safeurl/db
├── db                    # Default database instance (use this!)
├── createDatabase()      # Factory function (for custom configs)
├── executeRawSQL()       # Execute raw SQL queries
├── executeRawSQLString() # Execute raw SQL strings
├── scanJobs              # Schema: scan_jobs table
├── scanResults           # Schema: scan_results table
├── users                 # Schema: users table
├── wallets               # Schema: wallets table
├── auditLogs             # Schema: audit_logs table
└── Database              # TypeScript type
```

## Service-Specific Files

The following files exist but **only re-export** from `@safeurl/db`:

- `apps/api/src/lib/db.ts` - Re-exports `db` from `@safeurl/db`
- `apps/worker/src/lib/db.ts` - Re-exports `db` from `@safeurl/db`

**These files are deprecated** - import directly from `@safeurl/db` instead.

## Configuration

Database configuration is centralized in `@safeurl/db`:

- Reads `DATABASE_URL` environment variable
- Reads `DATABASE_AUTH_TOKEN` environment variable (for Turso Cloud)
- Supports both local SQLite (`file:./local.db`) and Turso Cloud (`libsql://...`)

## Migration

All migrations are managed in `packages/db`:

```bash
# Generate migration from schema changes
cd packages/db
bun run db:generate

# Apply migrations
bun run db:migrate

# Push schema (dev only)
bun run db:push
```

## Verification Checklist

When adding new database code, verify:

- [ ] Imports `db` from `@safeurl/db` (not from `@libsql/client`)
- [ ] Imports schemas from `@safeurl/db` (not defined locally)
- [ ] Uses the shared `db` instance (not creating new clients)
- [ ] No direct `@libsql/client` imports in service code
- [ ] No direct `drizzle()` calls in service code

## Examples by Service

### API Service

```typescript
// apps/api/src/modules/scans/service.ts
import { db, scanJobs, users, wallets, executeRawSQL } from "@safeurl/db";
import { eq, sql } from "drizzle-orm";

// Use db, scanJobs, etc. directly
```

### Worker Service

```typescript
// apps/worker/src/state/transitions.ts
import { db, scanJobs } from "@safeurl/db";
import { eq } from "drizzle-orm";

// Use db, scanJobs directly
```

### Tests

```typescript
// apps/api/src/modules/scans/scan.integration.test.ts
import { db, wallets, users, executeRawSQLString } from "@safeurl/db";

// Use db, schemas, utilities directly
```

## Troubleshooting

### "Cannot find module @safeurl/db"

Ensure the package is installed:
```bash
bun install
```

### "Database client not initialized"

Ensure `DATABASE_URL` environment variable is set:
```bash
export DATABASE_URL="file:./local.db"
# or
export DATABASE_URL="libsql://your-database.turso.io"
```

### Multiple Database Instances

If you see multiple database connections, ensure all code imports from `@safeurl/db` and uses the shared `db` instance.

## Summary

**Golden Rule**: If you need database access, import from `@safeurl/db`. Never create database clients directly.

```typescript
// ✅ Always do this:
import { db, scanJobs, users } from "@safeurl/db";

// ❌ Never do this:
import { createClient } from "@libsql/client";
```

