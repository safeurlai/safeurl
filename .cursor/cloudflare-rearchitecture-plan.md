# Cloudflare Rearchitecture Plan

## Executive Summary

This document outlines the plan to migrate the SafeURL monorepo from a Docker/Redis-based architecture to a Cloudflare-native architecture using Cloudflare Workers, Queues, and Playwright.

## Current Architecture

### Components

1. **API Service** (`apps/api`)
   - Elysia-based REST API
   - Creates scan jobs in Turso database
   - Enqueues jobs to BullMQ (Redis-backed queue)
   - Handles user authentication and credit management

2. **Worker Service** (`apps/worker`)
   - BullMQ worker consuming from Redis queue
   - Manages job state transitions (QUEUED → FETCHING → ANALYZING → COMPLETED)
   - Spawns ephemeral Docker containers for fetcher execution
   - Processes results and stores in database

3. **Fetcher Service** (`apps/fetcher`)
   - Standalone Bun script executed in Docker containers
   - Fetches URLs with SSRF protection
   - Uses Mastra agent for AI analysis
   - Uses Playwright (local) for screenshot analysis
   - Returns results via stdout JSON

4. **Database**
   - Turso (SQLite-compatible) for persistent storage
   - Stores scan jobs, results, users, wallets, audit logs

### Current Flow

```
User Request → API → Create Job (DB) → Enqueue (BullMQ/Redis)
                                              ↓
                                         Worker (BullMQ)
                                              ↓
                                    Spawn Docker Container
                                              ↓
                                    Fetcher (Bun Script)
                                              ↓
                                    Playwright (Local)
                                              ↓
                                    Mastra Agent Analysis
                                              ↓
                                    Return Results (stdout)
                                              ↓
                                         Worker
                                              ↓
                                    Store Results (DB)
```

## Target Cloudflare Architecture

### Components

1. **API Worker** (`apps/api`)
   - Cloudflare Worker (can remain Elysia or migrate to Hono/standard Worker)
   - Creates scan jobs in Turso database
   - Sends messages to Cloudflare Queue (producer)
   - Handles user authentication and credit management

2. **Fetcher Worker** (`apps/fetcher`)
   - Cloudflare Worker with queue consumer
   - Receives messages from Cloudflare Queue
   - Fetches URLs with SSRF protection
   - Uses Cloudflare Playwright for screenshots (transient, in-memory only)
   - Uses Mastra agent for AI analysis
   - **Screenshots are NEVER stored** - only used transiently for vision model analysis
   - Only screenshot hash is kept for deduplication/audit
   - Stores results directly in database
   - Manages job state transitions

3. **Cloudflare Queue**
   - Native Cloudflare Queues for job processing
   - Replaces BullMQ/Redis
   - Automatic retries and batching

4. **Database**
   - **Recommended: Migrate to Cloudflare D1** (best performance and cost)
   - **Alternative: Keep Turso** (if migration not feasible immediately)
   - D1: Direct bindings, no HTTP API needed, lower latency
   - Turso: Accessible from Workers via HTTP API or direct connection

### Target Flow

```
User Request → API Worker → Create Job (D1) → Send to Queue
                                                      ↓
                                            Cloudflare Queue
                                                      ↓
                                            Fetcher Worker
                                                      ↓
                                            Fetch URL + Screenshot (Playwright, transient)
                                                      ↓
                                            Mastra Agent Analysis (screenshot in-memory only)
                                                      ↓
                                            Store Results (D1, NO screenshots stored)
```

## Key Changes

### 1. Queue Migration: BullMQ → Cloudflare Queues

**Current:**

- BullMQ with Redis backend
- Worker service polls Redis
- Manual retry configuration

**Target:**

- Cloudflare Queues (native)
- Producer: API Worker sends messages
- Consumer: Fetcher Worker receives messages
- Built-in retry and batching

**Migration Steps:**

1. Replace `apps/api/src/lib/queue.ts` to use Cloudflare Queue binding
2. Remove BullMQ and ioredis dependencies
3. Update `apps/api/src/modules/scans/service.ts` to use `env.QUEUE.send()`
4. Remove `apps/worker` service (functionality moves to fetcher)

### 2. Fetcher Migration: Bun Script → Cloudflare Worker

**Current:**

- Standalone Bun script
- Executed in Docker containers
- Command-line arguments (jobId, url)
- stdout JSON output

**Target:**

- Cloudflare Worker with queue consumer
- Receives messages from queue
- Direct execution (no containers)
- HTTP-based database access

**Migration Steps:**

1. Convert `apps/fetcher/src/index.ts` to Cloudflare Worker format
2. Add `queue()` handler for consuming messages
3. Replace command-line parsing with message body parsing
4. Update database access to use Turso HTTP API or direct connection
5. Remove Docker container spawning logic

### 3. Playwright Migration: Local → Cloudflare Playwright

**Current:**

- Local Playwright (chromium) in Docker container
- Full browser automation
- Screenshot capture

**Target:**

- Cloudflare Playwright (`@cloudflare/playwright`) in Workers
- Browser Rendering API integration
- Same API, different runtime
- Screenshot capture (transient, in-memory only)
- **Screenshots NEVER stored** - only used for vision model analysis
- Only screenshot hash stored for deduplication

**Migration Steps:**

1. Install `@cloudflare/playwright` package
2. Update `wrangler.toml` to include browser binding:
   ```toml
   [browser]
   binding = "MYBROWSER"
   ```
3. Update `packages/mastra/src/tools/screenshot-analysis.ts`:
   - Replace `import { chromium } from 'playwright'` with `import { launch } from '@cloudflare/playwright'`
   - Replace `chromium.launch()` with `launch(env.MYBROWSER)`
   - Keep rest of API the same (page.goto, page.screenshot, etc.)
4. Update browser launch configuration for Cloudflare environment
5. Test screenshot functionality

**Note:** Cloudflare Playwright requires:

- `compatibility_date` >= "2025-09-15" in wrangler.toml (minimum requirement)
- `compatibility_flags = ["nodejs_compat"]` is required
- Browser binding in wrangler.toml

**Note:** With `compatibility_date >= "2024-09-23"` and `nodejs_compat` enabled, `nodejs_compat_v2` is automatically enabled, providing enhanced Node.js API support.

### 4. Worker Service Removal

**Current:**

- Separate worker service managing containers
- State transition management
- Result processing

**Target:**

- Fetcher Worker handles everything
- State transitions in fetcher
- Direct result storage

**Migration Steps:**

1. Move state transition logic to fetcher worker
2. Move result processing to fetcher worker
3. Remove `apps/worker` directory
4. Update database access patterns

## Implementation Phases

### Phase 1: Queue Infrastructure Setup

**Goal:** Set up Cloudflare Queue and producer

**Tasks:**

1. Create Cloudflare Queue in dashboard/CLI
2. Update `apps/api/src/lib/queue.ts`:
   - Remove BullMQ/ioredis
   - Add Queue type binding
   - Implement `send()` using Cloudflare Queue API
3. Update `apps/api/src/modules/scans/service.ts`:
   - Replace `scanQueue.add()` with `env.SCAN_QUEUE.send()`
4. Update `wrangler.toml` for API worker with queue binding
5. Test producer (send messages to queue)

**Files to Modify:**

- `apps/api/src/lib/queue.ts` (rewrite)
- `apps/api/src/modules/scans/service.ts` (update enqueue logic)
- `apps/api/wrangler.toml` (new, add queue binding)
- `apps/api/package.json` (remove bullmq, ioredis)

**Dependencies:**

- Cloudflare account and Wrangler CLI setup

### Phase 2: Fetcher Worker Conversion

**Goal:** Convert fetcher to Cloudflare Worker with queue consumer

**Tasks:**

1. Create `apps/fetcher/wrangler.toml`:
   - Configure queue consumer binding
   - Set up environment variables
   - Configure Turso database connection
2. Rewrite `apps/fetcher/src/index.ts`:
   - Remove command-line parsing
   - Add `queue()` handler
   - Parse message body (jobId, url, userId)
   - Keep existing fetch and analysis logic
3. Update database access:
   - Use Turso HTTP API or direct connection
   - Update state transition functions
4. Update `apps/fetcher/package.json`:
   - Add `@cloudflare/workers-types`
   - Remove Bun-specific dependencies if any
5. Test queue consumer

**Files to Modify:**

- `apps/fetcher/src/index.ts` (major rewrite)
- `apps/fetcher/wrangler.toml` (new)
- `apps/fetcher/package.json` (update dependencies)
- `apps/fetcher/src/lib/db.ts` (new, for Turso access from Worker)

**New Files:**

- `apps/fetcher/src/lib/db.ts` (Turso client for Workers)
- `apps/fetcher/src/state/transitions.ts` (moved from worker service)

### Phase 3: Playwright Migration

**Goal:** Replace local Playwright with Cloudflare Playwright

**Tasks:**

1. Research Cloudflare Playwright API:
   - Check documentation for `@cloudflare/playwright` or similar
   - Understand API differences
2. Update `packages/mastra/src/tools/screenshot-analysis.ts`:
   - Replace Playwright imports
   - Update browser launch configuration
   - Test screenshot capture
3. Update `packages/mastra/package.json`:
   - Replace `playwright` with Cloudflare Playwright package
4. Test screenshot analysis in fetcher worker

**Files to Modify:**

- `packages/mastra/src/tools/screenshot-analysis.ts`
- `packages/mastra/package.json`

**Note:** Cloudflare Playwright is available via `@cloudflare/playwright` package. It integrates with Cloudflare's Browser Rendering service and works seamlessly in Workers.

### Phase 4: State Management Migration

**Goal:** Move state transitions from worker service to fetcher worker

**Tasks:**

1. Move `apps/worker/src/state/transitions.ts` to `apps/fetcher/src/state/`
2. Update state transition calls in fetcher
3. Ensure optimistic locking still works with Turso
4. Test state transitions

**Files to Modify:**

- `apps/fetcher/src/index.ts` (add state transitions)
- `apps/fetcher/src/state/transitions.ts` (moved from worker)

### Phase 5: Result Processing Migration

**Goal:** Move result processing to fetcher worker

**Tasks:**

1. Move `apps/worker/src/process/results.ts` to `apps/fetcher/src/process/`
2. Update result processing in fetcher
3. Ensure audit logging works
4. Test end-to-end flow

**Files to Modify:**

- `apps/fetcher/src/index.ts` (add result processing)
- `apps/fetcher/src/process/results.ts` (moved from worker)

### Phase 6: Cleanup and Testing

**Goal:** Remove old code and ensure everything works

**Tasks:**

1. Remove `apps/worker` directory
2. Update monorepo scripts
3. Update documentation
4. Run integration tests
5. Update deployment configurations

**Files to Remove:**

- `apps/worker/` (entire directory)

**Files to Update:**

- Root `package.json` (remove worker scripts)
- `docker-compose.yml` (remove worker service)
- `Tiltfile` (remove worker service)
- Documentation files

## Privacy & Legal Compliance

### Screenshot Handling Policy

**CRITICAL: Screenshots are NEVER stored**

1. **Transient Use Only:**
   - Screenshots are captured in-memory using Cloudflare Playwright
   - Converted to base64 for vision model API calls
   - Immediately discarded after analysis
   - Never written to disk, database, or object storage

2. **What IS Stored:**
   - Screenshot hash (SHA-256) for deduplication
   - Visual analysis results (text descriptions)
   - Metadata (viewport size, content type, etc.)
   - NO image data, NO base64 strings

3. **Legal Compliance:**
   - Avoids storing potentially problematic visual content
   - Privacy-first design
   - Reduces legal liability
   - Maintains audit trail without content storage

4. **Implementation:**
   - Screenshot tool returns `screenshotBase64` for vision model
   - Vision model receives image, returns text analysis
   - Screenshot data goes out of scope immediately
   - Only hash and analysis results are persisted

## Technical Considerations

### Database Access from Workers

**Recommended: Cloudflare D1 (Best Performance & Cost)**

D1 is Cloudflare's native SQLite-based serverless database, optimized for Workers:

**Advantages:**

- ✅ **Direct bindings** - No HTTP API needed, native integration
- ✅ **Lower latency** - Co-located with Workers on Cloudflare's edge
- ✅ **Better cost** - No external database hosting fees
- ✅ **SQLite compatible** - Easy migration from Turso (both use SQLite)
- ✅ **No egress charges** - No data transfer costs
- ✅ **Built-in features** - Time Travel (point-in-time recovery), migrations, query insights

**Pricing (Workers Paid):**

- **Reads:** First 25 billion/month included, then $0.001 per million rows
- **Writes:** First 50 million/month included, then $1.00 per million rows
- **Storage:** First 5 GB included, then $0.75 per GB-month
- **Free tier:** 5M reads/day, 100K writes/day, 5GB storage

**Limits:**

- 10 GB per database (can create thousands of databases)
- 1 TB total storage per account (can be increased)
- 50,000 databases per account (can be increased)

**Migration from Turso:**

- Both use SQLite, so schema is compatible
- Export Turso data to SQL, import to D1
- Update code to use D1 bindings instead of Turso client

**Alternative: Turso (If D1 migration not immediate)**

**Option 1: Turso HTTP API**

- Use Turso's REST API from Workers
- Requires HTTP client
- May have rate limits

**Option 2: Direct Connection**

- Use `@libsql/client/web` with HTTP mode
- Works from Workers
- Better performance than HTTP API

**Recommendation:** Migrate to D1 for best performance and cost efficiency. If keeping Turso temporarily, use direct connection with HTTP mode.

### Playwright in Cloudflare

**Confirmed:**

- ✅ Cloudflare has native Playwright support via `@cloudflare/playwright` package
- ✅ Package integrates with Cloudflare's Browser Rendering service
- ✅ API is similar to standard Playwright with some differences:
  - Use `launch(env.MYBROWSER)` instead of `chromium.launch()`
  - Use `using` statements for automatic resource cleanup
  - Requires browser binding in wrangler.toml
  - Requires `compatibility_date >= "2025-09-15"` and `nodejs_compat` flag

**Limitations:**

- Browser sessions are transient (no persistent browser instances)
- Screenshots are in-memory only (not stored to disk)
- CPU time limits apply (default 30s, can increase to 5 minutes)

### Queue Configuration

**Settings to Configure:**

- Queue name: `scan-jobs`
- Consumer concurrency (`max_concurrency`, defaults to auto)
- Retry settings (delay, max attempts)
- Dead letter queue (if needed)
- Message retention period
- Queue-level delivery delays

**Example `wrangler.toml` for Fetcher:**

```toml
name = "safeurl-fetcher"
main = "src/index.ts"
compatibility_date = "2025-09-17"
compatibility_flags = ["nodejs_compat"]

# CPU time limit: 5 minutes (300,000 ms) for screenshot + AI analysis
[limits]
cpu_ms = 300000

[[queues.consumers]]
queue = "scan-jobs"
max_batch_size = 10  # optional, defaults to 10
max_batch_timeout = 30  # optional, defaults to 5 seconds
max_retries = 3  # optional, defaults to 3
retry_delay = 300  # optional, 5 minutes delay before retrying failed messages
max_concurrency = 10  # optional, 1-250, or omit for auto (recommended)
dead_letter_queue = "scan-jobs-dlq"

[browser]
binding = "MYBROWSER"

# D1 Database binding (recommended - no secrets needed)
[[d1_databases]]
binding = "DB"
database_name = "safeurl-db"
database_id = "<database-id>"

# OR if using Turso temporarily:
# Use [vars] for non-sensitive configuration
# [vars]
# TURSO_CONNECTION_URL = "libsql://..."

# Use secrets for sensitive data (set via: wrangler secret put TURSO_AUTH_TOKEN)
# Secrets are referenced in code as env.TURSO_AUTH_TOKEN
# Do NOT put secrets in wrangler.toml
```

**Queue-Level Configuration:**

Create queue with delivery delay and retention settings:

```bash
# Create queue with delivery delay (all messages delayed by 60 seconds)
wrangler queues create scan-jobs --delivery-delay-secs=60

# Update message retention period (default: 4 days, range: 60 seconds to 14 days)
wrangler queues update scan-jobs --message-retention-period-secs=3000
```

**Consumer Concurrency:**

Control how many consumer Workers can process messages concurrently:

- Default: "auto" (scales based on queue depth)
- Custom: Set `max_concurrency` between 1-250
- Higher concurrency = faster processing but more CPU time costs

**Retry Delays:**

Configure default retry delay for failed messages:

```toml
[[queues.consumers]]
queue = "scan-jobs"
retry_delay = 300  # 5 minutes delay before retrying
```

Or set per-message delays in code:

```typescript
message.retry({ delaySeconds: 3600 }); // 1 hour delay
```

**Example `wrangler.toml` for API (with Better Auth + D1):**

```toml
name = "safeurl-api"
main = "src/index.ts"
compatibility_date = "2025-09-17"
compatibility_flags = ["nodejs_compat"]

[[queues.producers]]
queue = "scan-jobs"
binding = "SCAN_QUEUE"
delivery_delay = 0  # optional, delay all messages by X seconds (default: 0)

# D1 Database binding (recommended - no secrets needed)
[[d1_databases]]
binding = "DB"
database_name = "safeurl-db"
database_id = "<database-id>"

# Use [vars] for non-sensitive configuration
[vars]
GOOGLE_CLIENT_ID = "your-google-client-id"  # OAuth client IDs can be public
GITHUB_CLIENT_ID = "your-github-client-id"

# Use secrets for sensitive data (set via: wrangler secret put <NAME>)
# Do NOT put secrets in wrangler.toml
# Set these via: wrangler secret put BETTER_AUTH_SECRET
#               wrangler secret put GOOGLE_CLIENT_SECRET
#               wrangler secret put GITHUB_CLIENT_SECRET
```

**Example `wrangler.toml` for API (with Clerk + Turso - temporary):**

```toml
name = "safeurl-api"
main = "src/index.ts"
compatibility_date = "2025-09-17"
compatibility_flags = ["nodejs_compat"]

[[queues.producers]]
queue = "scan-jobs"
binding = "SCAN_QUEUE"

# Use [vars] for non-sensitive configuration
[vars]
TURSO_CONNECTION_URL = "libsql://..."
CLERK_PUBLISHABLE_KEY = "pk_..."

# Use secrets for sensitive data (set via: wrangler secret put <NAME>)
# Do NOT put secrets in wrangler.toml
# Set these via: wrangler secret put TURSO_AUTH_TOKEN
#               wrangler secret put CLERK_SECRET_KEY
```

**Note:** Cloudflare now supports both `wrangler.toml` and `wrangler.jsonc` formats. The examples use TOML, but JSONC is also valid.

### Environment Variables and Secrets

**API Worker (with Better Auth + D1):**

- D1 database binding (via wrangler.toml) - **no secrets needed**
- Better Auth secret key (use **secret** for session encryption)
- OAuth provider secrets (Google, GitHub, etc.) - use **secrets**
- Queue binding (via wrangler.toml)

**API Worker (with Clerk + Turso - temporary):**

- `TURSO_CONNECTION_URL` (can be in `[vars]`)
- `TURSO_AUTH_TOKEN` (use **secret**, not var)
- `CLERK_SECRET_KEY` (use **secret**, not var)
- `CLERK_PUBLISHABLE_KEY` (can be in `[vars]`)
- Queue binding (via wrangler.toml)

**Fetcher Worker (with D1):**

- D1 database binding (via wrangler.toml) - **no secrets needed**
- `OPENROUTER_API_KEY` (use **secret**, not var)
- Queue binding (via wrangler.toml)

**Fetcher Worker (with Turso - temporary):**

- `TURSO_CONNECTION_URL` (can be in `[vars]`)
- `TURSO_AUTH_TOKEN` (use **secret**, not var)
- `OPENROUTER_API_KEY` (use **secret**, not var)
- Queue binding (via wrangler.toml)

**Setting Secrets:**

```bash
# Set secrets (not stored in wrangler.toml)

# For Better Auth + D1:
wrangler secret put BETTER_AUTH_SECRET  # Session encryption key
wrangler secret put GOOGLE_CLIENT_SECRET  # If using Google OAuth
wrangler secret put GITHUB_CLIENT_SECRET  # If using GitHub OAuth
wrangler secret put OPENROUTER_API_KEY

# For Clerk + Turso (temporary):
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put CLERK_SECRET_KEY
```

**Security Best Practice:** Never commit secrets to version control. Use `wrangler secret put` for sensitive values, and only use `[vars]` for non-sensitive configuration.

### Error Handling

**Queue Consumer Error Handling:**

**Automatic Retries:**

- If `queue()` handler throws or returns a rejected promise, all messages are retried
- Retries respect `max_retries` configuration
- After `max_retries`, messages go to dead letter queue (if configured)
- Messages are automatically acknowledged when handler returns successfully

**Explicit Retries:**

```typescript
export default {
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processMessage(message.body);
        // Success - message auto-acknowledged when handler returns
      } catch (error) {
        if (message.attempts < 3) {
          message.retry({ delaySeconds: 60 }); // Retry with delay
        } else {
          // Log to dead letter queue handling
          console.error("Message failed after max retries:", message.id);
          // Message will go to DLQ after max_retries
        }
      }
    }
  },
};
```

**Message Acknowledgment:**

- Messages are automatically acknowledged when the `queue()` handler returns successfully
- Only call `message.ack()` if you want to acknowledge early (before handler completes)
- Only call `message.retry()` if you want to explicitly retry a message

**State Transitions:**

- Keep optimistic locking
- Handle version conflicts
- Transition to FAILED on errors

## Migration Checklist

### Pre-Migration

- [ ] Set up Cloudflare account
- [ ] Install Wrangler CLI
- [ ] Create Cloudflare Queue
- [ ] Research Cloudflare Playwright API
- [ ] Test Turso connection from Workers

### Phase 1: Queue Infrastructure

- [ ] Remove BullMQ from API
- [ ] Add Cloudflare Queue producer
- [ ] Update API to send to queue
- [ ] Test message sending

### Phase 2: Fetcher Worker

- [ ] Create wrangler.toml for fetcher
- [ ] Convert fetcher to Worker format
- [ ] Add queue consumer handler
- [ ] Update database access
- [ ] Test queue consumption

### Phase 3: Playwright

- [ ] Research Cloudflare Playwright
- [ ] Update screenshot tool
- [ ] **Verify screenshots are NEVER stored** (only hash persisted)
- [ ] Test screenshot capture
- [ ] Code review to ensure no screenshot persistence

### Phase 4: State Management

- [ ] Move state transitions to fetcher
- [ ] Test state transitions
- [ ] Ensure optimistic locking works

### Phase 5: Result Processing

- [ ] Move result processing to fetcher
- [ ] Test end-to-end flow
- [ ] Verify audit logging

### Phase 6: Cleanup

- [ ] Remove worker service
- [ ] Update documentation
- [ ] Update deployment configs
- [ ] Run integration tests

## Best Practices

### Queue Consumer Best Practices

1. **Process messages individually** - Handle each message separately to avoid batch failures
2. **Use async iteration** - Use `for (const msg of batch.messages)` not `forEach`
3. **Acknowledge early** - Call `message.ack()` if processing is long-running
4. **Handle retries explicitly** - Use exponential backoff for retries
5. **Monitor queue depth** - Use Cloudflare dashboard to monitor queue health
6. **Handle errors gracefully** - Transition jobs to FAILED state on permanent errors

### Playwright Best Practices

1. **Use 'using' statements** - Ensures proper resource cleanup
2. **Set timeouts appropriately** - Configure `page.goto()` timeouts
3. **Handle browser launch failures** - Retry browser launch if it fails
4. **Optimize screenshot settings** - Use appropriate image formats and quality
5. **Never store screenshots** - Only use transiently for vision model analysis

### Error Monitoring

1. **Use Workers Logs** - Monitor errors in Cloudflare dashboard
2. **Set up alerts** - Configure alerts for high error rates
3. **Track queue depth** - Monitor if queue is backing up
4. **Monitor CPU time** - Track if workers are hitting CPU limits
5. **Dead letter queue monitoring** - Set up alerts for DLQ messages

## Benefits of Migration

1. **Simplified Architecture**
   - Fewer services to manage
   - No Docker containers
   - No Redis infrastructure

2. **Better Scalability**
   - Cloudflare Workers auto-scale
   - Queue handles load automatically
   - No container orchestration needed

3. **Cost Efficiency**
   - Pay per request (Workers)
   - No idle container costs
   - No Redis hosting costs

4. **Performance**
   - Edge computing (low latency)
   - Fast queue processing
   - Optimized for Cloudflare network

5. **Developer Experience**
   - Simpler deployment
   - Better observability (Cloudflare dashboard)
   - Native integrations

## Risks and Mitigations

### Risk 1: Cloudflare Playwright Compatibility Issues

**Mitigation:** Cloudflare Playwright is available. Test early, check compatibility flags, verify browser binding works correctly

### Risk 2: Turso Connection from Workers

**Mitigation:** Test early, use HTTP mode, consider D1 migration later

### Risk 3: State Transition Race Conditions

**Mitigation:** Keep optimistic locking, test thoroughly

### Risk 4: Queue Message Size Limits

**Mitigation:**

- Keep messages small (jobId, url, userId only)
- Individual message limit: **128 KB**
- Batch limit: **256 KB total** (up to 100 messages per batch)
- Messages must be JSON-serializable or use structured clone algorithm
- Use `contentType` option when sending non-JSON data:

  ```typescript
  // JSON (default, recommended)
  await env.SCAN_QUEUE.send({ jobId, url, userId }, { contentType: "json" });

  // Bytes (for binary data)
  await env.SCAN_QUEUE.send(buffer, { contentType: "bytes" });

  // V8 (for non-JSON-serializable objects like Date, Map)
  await env.SCAN_QUEUE.send(data, { contentType: "v8" });
  ```

### Risk 5: Worker Execution Time Limits

**Mitigation:**

- Default CPU time limit: **30 seconds** (30,000 ms)
- Can be increased to **5 minutes** (300,000 ms) in wrangler.toml:
  ```toml
  [limits]
  cpu_ms = 300000
  ```
- Monitor CPU time in Workers dashboard
- Optimize long-running operations (screenshot capture, AI analysis)
- Consider breaking work into smaller chunks if needed
- **Duration** (wall time) has no hard limit, but CPU time is what matters for billing and limits

### Risk 6: Screenshot Storage (Legal/Privacy)

**Mitigation:**

- Screenshots are NEVER stored - only used transiently for vision model
- Only screenshot hash is persisted
- Code review to ensure no screenshot persistence
- Automated checks to prevent screenshot storage

## Database Migration: Turso → D1

**Why Migrate to D1:**

1. **Performance:**
   - Direct bindings (no HTTP overhead)
   - Co-located with Workers (lower latency)
   - Native integration with Cloudflare platform

2. **Cost Efficiency:**
   - No external database hosting fees
   - No data transfer/egress charges
   - Generous free tier (5M reads/day, 100K writes/day, 5GB)
   - Pay only for usage above included limits

3. **Ease of Migration:**
   - Both use SQLite (schema compatible)
   - Simple export/import process
   - Minimal code changes (just update bindings)

**Migration Steps:**

1. **Export Turso data:**

   ```bash
   # Export schema and data from Turso
   turso db dump my-db > turso-export.sql
   ```

2. **Create D1 database:**

   ```bash
   npx wrangler d1 create safeurl-db
   ```

3. **Import to D1:**

   ```bash
   # Clean up SQL file (remove BEGIN TRANSACTION, COMMIT if present)
   # Then import
   npx wrangler d1 execute safeurl-db --remote --file=./turso-export.sql
   ```

4. **Update wrangler.toml:**

   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "safeurl-db"
   database_id = "<database-id-from-create-command>"
   ```

5. **Update Worker code:**

   ```typescript
   // Before (Turso):
   import { createClient } from "@libsql/client/web";

   const client = createClient({
     url: env.TURSO_CONNECTION_URL,
     authToken: env.TURSO_AUTH_TOKEN,
   });

   // After (D1):
   // No imports needed - D1 is available via binding
   const result = await env.DB.prepare("SELECT * FROM scans WHERE id = ?")
     .bind(scanId)
     .first();
   ```

6. **Remove Turso dependencies:**
   - Remove `@libsql/client` package
   - Remove Turso connection URL and auth token secrets
   - Update all database access code to use D1 API

**D1 API Examples:**

```typescript
// Query with prepared statement
const result = await env.DB.prepare("SELECT * FROM scans WHERE id = ?")
  .bind(scanId)
  .first();

// Batch operations
await env.DB.batch([
  env.DB.prepare("INSERT INTO scans (id, url) VALUES (?, ?)").bind(id1, url1),
  env.DB.prepare("INSERT INTO scans (id, url) VALUES (?, ?)").bind(id2, url2),
]);

// Transactions
await env.DB.batch([
  env.DB.prepare("UPDATE jobs SET status = ? WHERE id = ?").bind(
    "COMPLETED",
    jobId,
  ),
  env.DB.prepare("INSERT INTO results (job_id, data) VALUES (?, ?)").bind(
    jobId,
    resultData,
  ),
]);
```

## Authentication: Clerk vs Better Auth

### Current State

- Using **Clerk** for authentication
- Stores `clerk_user_id` in database
- Dashboard uses Clerk's Next.js components
- API extracts user IDs from Clerk JWT tokens

### Recommendation: Migrate to Better Auth + Drizzle + D1

**Why Better Auth is Better for Cloudflare Workers:**

1. **Native Cloudflare Integration:**
   - ✅ First-class D1 support via `better-auth-cloudflare` package
   - ✅ Works seamlessly with Drizzle ORM
   - ✅ No external API calls (all auth logic in Workers)
   - ✅ Lower latency (no network round-trips to Clerk)

2. **Cost Efficiency:**
   - ✅ **Free and open-source** (no per-user fees)
   - ✅ Clerk costs: $550/month for 10,000 users (beyond free tier)
   - ✅ Better Auth: Only pay for D1 storage/queries (included in Workers plan)
   - ✅ Significant cost savings at scale

3. **Performance:**
   - ✅ No external API calls to Clerk
   - ✅ All auth operations happen in Workers (faster)
   - ✅ Better caching with D1
   - ✅ Reduced latency (no network hops)

4. **Developer Experience:**
   - ✅ Full control over auth logic
   - ✅ Type-safe with Drizzle ORM
   - ✅ Customizable to your needs
   - ✅ Better debugging (all code in your repo)

5. **Migration Path:**
   - ✅ Both use user IDs (easy to migrate)
   - ✅ Can migrate users from Clerk to Better Auth
   - ✅ Drizzle schema migration support

**Clerk Advantages (to consider):**

- Managed service (less maintenance)
- Pre-built UI components
- Built-in social auth providers
- Compliance features (SOC2, GDPR)

**Better Auth Features:**

- Email/password authentication
- Social OAuth providers (Google, GitHub, etc.)
- Magic links
- 2FA/MFA support
- Session management
- Role-based access control (RBAC)

### Migration Steps: Clerk → Better Auth

1. **Install Better Auth:**

   ```bash
   npm install better-auth-cloudflare drizzle-orm
   ```

2. **Update Database Schema:**

   ```typescript
   // Add Better Auth tables to your Drizzle schema
   import { betterAuthSchema } from "better-auth-cloudflare";

   export const schema = {
     ...yourExistingSchema,
     ...betterAuthSchema,
   };
   ```

3. **Configure Better Auth:**

   ```typescript
   // apps/api/src/lib/auth.ts
   import { betterAuth } from "better-auth";
   import { withCloudflare } from "better-auth-cloudflare";
   import { drizzleAdapter } from "better-auth/adapters/drizzle";
   import { drizzle } from "drizzle-orm/d1";

   export function createAuth(env: { DB: D1Database }) {
     const db = drizzle(env.DB);

     return betterAuth(
       withCloudflare({
         adapter: drizzleAdapter(db, { provider: "sqlite" }),
         emailAndPassword: {
           enabled: true,
         },
         socialProviders: {
           google: {
             clientId: env.GOOGLE_CLIENT_ID,
             clientSecret: env.GOOGLE_CLIENT_SECRET,
           },
         },
       }),
     );
   }
   ```

4. **Update Worker Code:**

   ```typescript
   // Replace Clerk JWT validation with Better Auth
   export default {
     async fetch(request: Request, env: Env): Promise<Response> {
       const auth = createAuth(env);

       // Better Auth handles auth routes automatically
       const authResponse = await auth.handler(request);
       if (authResponse) return authResponse;

       // Your API routes
       // ...
     },
   };
   ```

5. **Migrate User Data:**

   ```typescript
   // Migration script to move users from Clerk to Better Auth
   // Map clerk_user_id to Better Auth user IDs
   ```

6. **Update Dashboard:**
   - Replace Clerk components with Better Auth components
   - Update auth middleware
   - Update user session handling

**Estimated Migration Effort:**

- Setup: 1-2 days
- User migration: 1 day
- Dashboard updates: 2-3 days
- Testing: 2-3 days
- **Total: ~1 week**

**Recommendation:** Migrate to Better Auth during the Cloudflare migration for:

- Better performance (no external API calls)
- Lower costs (free vs $550+/month)
- Native D1 integration
- Full control over auth logic

## Future Enhancements

1. **Database Migration to D1** ✅ **Recommended for Phase 1**
   - Migrate from Turso to Cloudflare D1
   - Better integration with Workers
   - Lower latency
   - Better cost efficiency

2. **Authentication Migration to Better Auth** ✅ **Recommended for Phase 1**
   - Migrate from Clerk to Better Auth
   - Native D1 + Drizzle integration
   - Lower costs and better performance
   - Full control over auth logic

3. **Durable Objects for State**
   - Use Durable Objects for job state
   - Better consistency guarantees
   - Real-time updates

4. **R2 for Other Assets** (NOT screenshots)
   - Store other assets in R2 if needed
   - **Screenshots remain transient only** - never stored
   - Better performance for other use cases

5. **Workers Analytics**
   - Use Cloudflare Analytics
   - Monitor performance
   - Track errors

## References

- [Cloudflare Queues Documentation](https://developers.cloudflare.com/queues/)
- [Cloudflare Queues JavaScript APIs](https://developers.cloudflare.com/queues/configuration/javascript-apis/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Playwright Documentation](https://developers.cloudflare.com/browser-rendering/playwright/)
- [Turso Documentation](https://docs.turso.tech/)
- [Turso Client for Workers](https://docs.turso.tech/sdk/ts/libsql-client)

## Quick Start Implementation Guide

### Step 1: Setup Cloudflare Account and Wrangler

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create a queue
wrangler queues create scan-jobs
```

### Step 2: API Worker - Queue Producer Example

**`apps/api/wrangler.toml`:**

```toml
name = "safeurl-api"
main = "src/index.ts"
compatibility_date = "2025-09-17"
compatibility_flags = ["nodejs_compat"]

[[queues.producers]]
queue = "scan-jobs"
binding = "SCAN_QUEUE"
```

**`apps/api/src/lib/queue.ts` (new implementation):**

```typescript
export interface QueueMessage {
  jobId: string;
  url: string;
  userId: string;
}

export async function sendToQueue(
  queue: Queue<QueueMessage>,
  message: QueueMessage,
): Promise<void> {
  // Send message with JSON content type (default)
  // Message size must be under 128 KB
  await queue.send(message, { contentType: "json" });

  // Alternative content types:
  // - "bytes" for binary data
  // - "v8" for non-JSON-serializable objects (Date, Map, etc.)
}
```

**`apps/api/src/modules/scans/service.ts` (update):**

```typescript
// Replace this:
await scanQueue.add("scan-url", { jobId, url, userId });

// With this:
await env.SCAN_QUEUE.send({ jobId, url, userId });
```

### Step 3: Fetcher Worker - Queue Consumer Example

**`apps/fetcher/wrangler.toml`:**

```toml
name = "safeurl-fetcher"
main = "src/index.ts"
compatibility_date = "2025-09-17"
compatibility_flags = ["nodejs_compat"]

# CPU time limit: 5 minutes for screenshot + AI analysis
[limits]
cpu_ms = 300000

[[queues.consumers]]
queue = "scan-jobs"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 3
dead_letter_queue = "scan-jobs-dlq"

[browser]
binding = "MYBROWSER"

# Use [vars] for non-sensitive configuration
[vars]
TURSO_CONNECTION_URL = "libsql://..."

# Use secrets for sensitive data (set via: wrangler secret put <NAME>)
# Do NOT put secrets in wrangler.toml
```

**`apps/fetcher/src/index.ts` (new structure):**

```typescript
interface Env {
  SCAN_QUEUE: Queue<QueueMessage>;
  MYBROWSER: Browser;
  TURSO_CONNECTION_URL: string;
  TURSO_AUTH_TOKEN: string;
  OPENROUTER_API_KEY: string;
}

interface QueueMessage {
  jobId: string;
  url: string;
  userId: string;
}

export default {
  async queue(
    batch: MessageBatch<QueueMessage>,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        const { jobId, url } = message.body;

        // Transition to FETCHING
        await transitionToFetching(jobId, env);

        // Fetch URL
        const fetchResult = await fetchUrl(url, {
          /* options */
        });

        // Analyze with agent (screenshot used transiently, never stored)
        // Screenshot is captured in-memory, sent to vision model, then discarded
        const analysisResult = await analyzeWithAgent(
          {
            url,
            contentHash: fetchResult.contentHash,
            // ... other fields
          },
          env,
        );
        // Screenshot data is now out of scope - only analysis results stored

        // Store results
        await processScanResults(
          jobId,
          {
            fetchResult,
            analysisResult,
          },
          env,
        );

        // Message is automatically acknowledged when handler returns successfully
        // Only call message.ack() if you want to acknowledge early
      } catch (error) {
        // Handle error, transition to FAILED
        await transitionToFailed(message.body.jobId, env);

        // Explicitly retry the message (or let it retry automatically on handler failure)
        if (message.attempts < 3) {
          message.retry({ delaySeconds: 60 }); // Retry with 1 minute delay
        }
        // After max_retries, message will go to dead letter queue
      }
    }
  },
};
```

### Step 4: Playwright Migration Example

**IMPORTANT: Privacy & Legal Compliance**

- Screenshots are **NEVER stored** - only used transiently in-memory for vision model analysis
- Only the screenshot hash is kept for deduplication/audit purposes
- Screenshot base64 is only passed to the vision model API and immediately discarded
- This maintains privacy-first design and avoids legal issues with storing visual content

**`packages/mastra/src/tools/screenshot-analysis.ts` (update):**

```typescript
// Before:

// After:
import { launch } from "@cloudflare/playwright";
import { chromium } from "playwright";

export async function executeScreenshotAnalysis(input) {
  const browser = await chromium.launch({ headless: true });
  // ...
  await browser.close();
}

// Types like Browser, Page are available from @cloudflare/playwright
// No need to import from 'playwright' package

interface Env {
  MYBROWSER: Browser;
}

export async function executeScreenshotAnalysis(
  input: ScreenshotInput,
  env: Env,
) {
  // Use 'using' statement for automatic resource cleanup
  await using browser = await launch(env.MYBROWSER);
  await using context = await browser.newContext();
  await using page = await context.newPage({
    viewport: {
      width: input.viewport?.width ?? 1920,
      height: input.viewport?.height ?? 1080,
    },
  });

  await page.goto(input.url, {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  const screenshotBuffer = await page.screenshot({
    type: input.imageFormat || "png",
    quality: input.imageFormat === "jpeg" ? input.quality : undefined,
    fullPage: false,
  });

  // Convert to base64 for vision model (transient use only)
  const screenshotBase64 = screenshotBuffer.toString("base64");

  // Generate hash for deduplication (this is what we store, NOT the image)
  const screenshotHash = await generateContentHash(screenshotBase64);

  // Screenshot base64 is returned for vision model analysis but NEVER stored
  // Only screenshotHash is persisted for audit/deduplication

  // ... rest of the logic stays the same

  // Resources automatically closed when 'using' block exits
  // Screenshot data is now out of scope and will be garbage collected
  // No persistent storage of screenshot content
}
```

### Step 5: Database Access from Worker

**`apps/fetcher/src/lib/db.ts` (new file):**

**Option 1: Using D1 (Recommended)**

```typescript
// D1 is available directly via binding - no client needed
// Access via env.DB in your Worker code

// Example usage:
export async function getScanJob(env: { DB: D1Database }, jobId: string) {
  const result = await env.DB.prepare("SELECT * FROM scan_jobs WHERE id = ?")
    .bind(jobId)
    .first();
  return result;
}

export async function updateJobStatus(
  env: { DB: D1Database },
  jobId: string,
  status: string,
) {
  await env.DB.prepare("UPDATE scan_jobs SET status = ? WHERE id = ?")
    .bind(status, jobId)
    .run();
}
```

**Option 2: Using Turso (Temporary)**

```typescript
import { createClient } from "@libsql/client/web";

export function createDbClient(env: {
  TURSO_CONNECTION_URL: string;
  TURSO_AUTH_TOKEN: string;
}) {
  return createClient({
    url: env.TURSO_CONNECTION_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}
```

## Next Steps

1. **Research Phase:**
   - ✅ Cloudflare Playwright is available via `@cloudflare/playwright`
   - ✅ **Migrate to D1** (recommended) or test Turso connection from Workers using `@libsql/client/web`
   - Set up Cloudflare account and Wrangler

2. **Proof of Concept:**
   - Create minimal queue producer/consumer
   - Test message flow
   - Verify database access
   - Test Playwright screenshot capture
   - **Verify screenshots are transient only** - check no persistence occurs

3. **Incremental Migration:**
   - Follow phases sequentially
   - Test after each phase
   - Keep old system running until migration complete

4. **Deployment:**
   - Deploy to Cloudflare staging
   - Run integration tests
   - Monitor performance
   - Deploy to production

## Verification Checklist

Based on documentation review, verify these items during implementation:

- [ ] Queue created with appropriate retention period
- [ ] Producer binding configured correctly
- [ ] Consumer binding configured with appropriate batch settings
- [ ] Dead letter queue created and configured
- [ ] CPU time limits set appropriately (consider 5 minutes for screenshot + AI)
- [ ] Browser binding configured in wrangler.toml
- [ ] Playwright compatibility date >= 2025-09-15
- [ ] nodejs_compat flag enabled
- [ ] Database configured (D1 recommended, or Turso with @libsql/client/web)
- [ ] Secrets configured for sensitive values (not vars)
- [ ] Error handling implemented for queue consumer
- [ ] Message size verified to be under 128 KB
- [ ] Retry logic implemented with appropriate delays
- [ ] Dead letter queue consumer configured (if needed)
- [ ] Screenshot persistence verified (NO screenshots stored, only hash)
- [ ] Using statements implemented for Playwright resource cleanup
- [ ] Queue consumer concurrency configured appropriately
- [ ] Monitoring and alerting set up for errors and queue depth
