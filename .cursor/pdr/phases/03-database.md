# Phase 3: Database Schema & Migrations

**Status:** Not Started  
**Dependencies:** Phase 1, Phase 2  
**Estimated Time:** 2-3 days

## Overview

Design and implement the database schema using Drizzle ORM, create migrations, and set up indexes for optimal query performance.

---

## 3.1 Core Tables (`packages/db`)

### Users Table

- [ ] **Schema Definition**:
  - [ ] `clerk_user_id` - String, primary key (Clerk user ID)
  - [ ] `created_at` - Timestamp, default now
  - [ ] `updated_at` - Timestamp, auto-update
  - [ ] `metadata` - JSON, optional user metadata
- [ ] **Relations**:
  - [ ] One-to-many with wallets
  - [ ] One-to-many with scan_jobs

### Wallets Table

- [ ] **Schema Definition**:
  - [ ] `id` - UUID, primary key
  - [ ] `user_id` - String, foreign key to users.clerk_user_id
  - [ ] `credit_balance` - Integer, default 0, non-negative
  - [ ] `created_at` - Timestamp, default now
  - [ ] `updated_at` - Timestamp, auto-update
- [ ] **Constraints**:
  - [ ] Unique constraint on user_id (one wallet per user)
  - [ ] Check constraint: credit_balance >= 0
- [ ] **Relations**:
  - [ ] Many-to-one with users
  - [ ] One-to-many with credit_transactions (future)

### Scan Jobs Table

- [ ] **Schema Definition**:
  - [ ] `id` - UUID, primary key
  - [ ] `user_id` - String, foreign key to users.clerk_user_id
  - [ ] `url` - String, indexed, SSRF-validated
  - [ ] `state` - Enum: QUEUED, FETCHING, ANALYZING, COMPLETED, FAILED, TIMED_OUT
  - [ ] `created_at` - Timestamp, default now
  - [ ] `updated_at` - Timestamp, auto-update
  - [ ] `version` - Integer, default 1 (for optimistic concurrency)
- [ ] **Constraints**:
  - [ ] State enum validation
  - [ ] URL format validation (application-level)
- [ ] **Relations**:
  - [ ] Many-to-one with users
  - [ ] One-to-one with scan_results
  - [ ] One-to-many with audit_logs

### Scan Results Table

- [ ] **Schema Definition**:
  - [ ] `job_id` - UUID, foreign key to scan_jobs.id, unique
  - [ ] `risk_score` - Integer, 0-100
  - [ ] `categories` - JSON array of strings
  - [ ] `content_hash` - String, SHA-256 hash
  - [ ] `http_status` - Integer, nullable
  - [ ] `http_headers` - JSON object, sanitized
  - [ ] `content_type` - String, MIME type
  - [ ] `model_used` - String, LLM model identifier
  - [ ] `analysis_metadata` - JSON, additional analysis data
  - [ ] `reasoning` - Text, agent's reasoning
  - [ ] `indicators` - JSON array of strings
  - [ ] `created_at` - Timestamp, default now
- [ ] **Constraints**:
  - [ ] Unique constraint on job_id
  - [ ] Check constraint: risk_score between 0 and 100
  - [ ] Content hash format validation
- [ ] **Relations**:
  - [ ] One-to-one with scan_jobs

---

## 3.2 Audit Logs Table

### Audit Logs Table

- [ ] **Schema Definition**:
  - [ ] `id` - UUID, primary key
  - [ ] `scan_job_id` - UUID, foreign key to scan_jobs.id
  - [ ] `url_accessed` - String, indexed
  - [ ] `timestamp` - Timestamp, default now
  - [ ] `content_hash` - String, SHA-256 hash
  - [ ] `http_status` - Integer, nullable
  - [ ] `http_headers` - JSON object, sanitized
  - [ ] `content_type` - String, MIME type
  - [ ] `risk_assessment_summary` - JSON object
- [ ] **Constraints**:
  - [ ] Append-only constraint (no updates allowed)
  - [ ] Content hash format validation
  - [ ] **Explicitly exclude**: No content body, screenshots, or DOM fields
- [ ] **Relations**:
  - [ ] Many-to-one with scan_jobs

### Audit Log Integrity

- [ ] **Immutable Records**:
  - [ ] Database-level constraint preventing updates
  - [ ] Application-level validation
  - [ ] Read-only access pattern
- [ ] **Content Exclusion Verification**:
  - [ ] Schema validation ensures no content fields
  - [ ] Migration checks for content-related columns
  - [ ] Application tests verify no content storage

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

- [ ] **Scan Jobs Indexes**:
  - [ ] Index on `user_id` for user queries
  - [ ] Index on `state` for worker queries
  - [ ] Index on `created_at` for time-based queries
  - [ ] Composite index on `(user_id, created_at)` for user history
- [ ] **Audit Logs Indexes**:
  - [ ] Index on `scan_job_id` for job lookup
  - [ ] Index on `timestamp` for time-based queries
  - [ ] Index on `url_accessed` for URL lookup
  - [ ] Composite index on `(scan_job_id, timestamp)`

### Migration Scripts

- [ ] Set up migration scripts in `package.json`:
  - [ ] `db:migrate` - Run migrations
  - [ ] `db:generate` - Generate migration from schema changes
  - [ ] `db:studio` - Open Drizzle Studio
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

- [ ] Configure libSQL driver:
  - [ ] Connection string from environment
  - [ ] Auth token handling
  - [ ] Local vs remote database support
- [ ] Set migration output directory
- [ ] Configure schema path
- [ ] Set up Drizzle Studio configuration

### Schema Organization

- [ ] Organize schemas in logical files:
  - [ ] `schema/users.ts`
  - [ ] `schema/wallets.ts`
  - [ ] `schema/scan-jobs.ts`
  - [ ] `schema/scan-results.ts`
  - [ ] `schema/audit-logs.ts`
- [ ] Export all schemas from `schema/index.ts`
- [ ] Set up type exports

---

## Success Criteria

- [ ] All tables are created with correct schemas
- [ ] Foreign key relationships work correctly
- [ ] Indexes improve query performance
- [ ] Migrations can be run and rolled back
- [ ] Audit logs table prevents content storage
- [ ] Optimistic concurrency control works
- [ ] All constraints are enforced

---

## Notes

- Use Drizzle's type inference for all queries
- Ensure audit logs are truly append-only
- Test migrations thoroughly before production
- Keep schema changes backward-compatible when possible
- Document all schema decisions

