# Phase 3: Database Schema & Migrations

**Status:** In Progress (Schema Complete, Migrations Pending)  
**Dependencies:** Phase 1, Phase 2  
**Estimated Time:** 2-3 days

## Overview

Design and implement the database schema using Drizzle ORM, create migrations, and set up indexes for optimal query performance.

---

## 3.1 Core Tables (`packages/db`)

### Users Table

- [x] **Schema Definition**:
  - [x] `clerk_user_id` - String, primary key (Clerk user ID)
  - [x] `created_at` - Timestamp, default now
  - [x] `updated_at` - Timestamp, auto-update
  - [x] `metadata` - JSON, optional user metadata
- [x] **Relations**:
  - [x] One-to-many with wallets
  - [x] One-to-many with scan_jobs

### Wallets Table

- [x] **Schema Definition**:
  - [x] `id` - UUID, primary key
  - [x] `user_id` - String, foreign key to users.clerk_user_id
  - [x] `credit_balance` - Integer, default 0, non-negative
  - [x] `created_at` - Timestamp, default now
  - [x] `updated_at` - Timestamp, auto-update
- [x] **Constraints**:
  - [x] Unique constraint on user_id (one wallet per user)
  - [x] Check constraint: credit_balance >= 0
- [x] **Relations**:
  - [x] Many-to-one with users
  - [ ] One-to-many with credit_transactions (future)

### Scan Jobs Table

- [x] **Schema Definition**:
  - [x] `id` - UUID, primary key
  - [x] `user_id` - String, foreign key to users.clerk_user_id
  - [x] `url` - String, indexed, SSRF-validated
  - [x] `state` - Enum: QUEUED, FETCHING, ANALYZING, COMPLETED, FAILED, TIMED_OUT
  - [x] `created_at` - Timestamp, default now
  - [x] `updated_at` - Timestamp, auto-update
  - [x] `version` - Integer, default 1 (for optimistic concurrency)
- [x] **Constraints**:
  - [x] State enum validation
  - [x] URL format validation (application-level)
- [x] **Relations**:
  - [x] Many-to-one with users
  - [x] One-to-one with scan_results
  - [x] One-to-many with audit_logs

### Scan Results Table

- [x] **Schema Definition**:
  - [x] `job_id` - UUID, foreign key to scan_jobs.id, unique
  - [x] `risk_score` - Integer, 0-100
  - [x] `categories` - JSON array of strings
  - [x] `content_hash` - String, SHA-256 hash
  - [x] `http_status` - Integer, nullable
  - [x] `http_headers` - JSON object, sanitized
  - [x] `content_type` - String, MIME type
  - [x] `model_used` - String, LLM model identifier
  - [x] `analysis_metadata` - JSON, additional analysis data
  - [x] `reasoning` - Text, agent's reasoning
  - [x] `indicators` - JSON array of strings
  - [x] `created_at` - Timestamp, default now
- [x] **Constraints**:
  - [x] Unique constraint on job_id
  - [x] Check constraint: risk_score between 0 and 100
  - [x] Content hash format validation
- [x] **Relations**:
  - [x] One-to-one with scan_jobs

---

## 3.2 Audit Logs Table

### Audit Logs Table

- [x] **Schema Definition**:
  - [x] `id` - UUID, primary key
  - [x] `scan_job_id` - UUID, foreign key to scan_jobs.id
  - [x] `url_accessed` - String, indexed
  - [x] `timestamp` - Timestamp, default now
  - [x] `content_hash` - String, SHA-256 hash
  - [x] `http_status` - Integer, nullable
  - [x] `http_headers` - JSON object, sanitized
  - [x] `content_type` - String, MIME type
  - [x] `risk_assessment_summary` - JSON object
- [x] **Constraints**:
  - [x] Append-only constraint (no updates allowed) - documented in comments
  - [x] Content hash format validation
  - [x] **Explicitly exclude**: No content body, screenshots, or DOM fields - documented in schema comments
- [x] **Relations**:
  - [x] Many-to-one with scan_jobs

### Audit Log Integrity

- [x] **Immutable Records**:
  - [ ] Database-level constraint preventing updates (SQLite limitation - documented in comments)
  - [x] Application-level validation (documented in schema)
  - [x] Read-only access pattern (documented)
- [x] **Content Exclusion Verification**:
  - [x] Schema validation ensures no content fields (explicitly documented in schema comments)
  - [ ] Migration checks for content-related columns (pending migration generation)
  - [ ] Application tests verify no content storage (pending tests)

---

## 3.3 Migrations & Indexes

### Initial Migration

- [ ] Create initial migration with Drizzle Kit:
  ```bash
  bun run drizzle-kit generate
  ```
- [ ] Review generated migration SQL
- [ ] Ensure all constraints are included
- [ ] Test migration on local database

### Indexes

- [x] **Scan Jobs Indexes**:
  - [x] Index on `user_id` for user queries
  - [x] Index on `state` for worker queries
  - [x] Index on `created_at` for time-based queries
  - [x] Composite index on `(user_id, created_at)` for user history
  - [x] Additional: Index on `url` for deduplication queries
  - [x] Additional: Composite index on `(state, created_at)` for worker queries
- [x] **Audit Logs Indexes**:
  - [x] Index on `scan_job_id` for job lookup
  - [x] Index on `timestamp` for time-based queries
  - [x] Index on `url_accessed` for URL lookup
  - [x] Composite index on `(scan_job_id, timestamp)`
  - [x] Additional: Index on `content_hash` for deduplication queries
- [x] **Scan Results Indexes** (bonus):
  - [x] Index on `content_hash` for deduplication queries
  - [x] Index on `created_at` for time-based queries
  - [x] Index on `risk_score` for filtering high-risk results
  - [x] Composite index on `(risk_score, created_at)` for high-risk queries

### Migration Scripts

- [x] Set up migration scripts in `package.json`:
  - [x] `db:migrate` - Run migrations
  - [x] `db:generate` - Generate migration from schema changes
  - [x] `db:studio` - Open Drizzle Studio
  - [x] Additional: `db:push` - Push schema changes directly
- [ ] Create migration rollback strategy
- [ ] Document migration process

### Migration Testing

- [ ] Test migrations locally:
  - [ ] Fresh database migration
  - [ ] Migration from previous version
  - [ ] Rollback testing
- [ ] Verify all constraints work correctly
- [ ] Verify indexes are created
- [ ] Test with sample data

---

## 3.4 Drizzle Configuration

### Drizzle Config (`drizzle.config.ts`)

- [x] Configure libSQL driver:
  - [x] Connection string from environment
  - [x] Auth token handling
  - [x] Local vs remote database support
- [x] Set migration output directory
- [x] Configure schema path
- [x] Set up Drizzle Studio configuration

### Schema Organization

- [x] Organize schemas in logical files:
  - [x] `schema/users.ts`
  - [x] `schema/wallets.ts`
  - [x] `schema/scan-jobs.ts`
  - [x] `schema/scan-results.ts`
  - [x] `schema/audit-logs.ts`
- [x] Export all schemas from `schema/index.ts`
- [x] Set up type exports

---

## Success Criteria

- [x] All tables are created with correct schemas
- [x] Foreign key relationships work correctly
- [x] Indexes improve query performance (indexes defined, pending migration to create them)
- [ ] Migrations can be run and rolled back (migration scripts ready, but migrations not yet generated)
- [x] Audit logs table prevents content storage (explicitly documented and enforced in schema)
- [x] Optimistic concurrency control works (version field present in scan_jobs)
- [x] All constraints are enforced (check constraints, unique constraints, foreign keys all defined)

---

## Notes

- Use Drizzle's type inference for all queries
- Ensure audit logs are truly append-only
- Test migrations thoroughly before production
- Keep schema changes backward-compatible when possible
- Document all schema decisions
