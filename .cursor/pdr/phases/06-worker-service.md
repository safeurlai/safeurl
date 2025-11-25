# Phase 6: Worker Service

**Status:** Completed  
**Dependencies:** Phase 1, Phase 2, Phase 3, Phase 4, Phase 5  
**Estimated Time:** 4-5 days

## Overview

Implement the worker service that processes scan jobs from the queue, manages state transitions, spawns fetcher containers, and stores results.

---

## 6.1 Worker Package Setup (`apps/worker`)

- [x] Create worker entry point
- [x] Install dependencies:
  - `bullmq` for queue processing
  - `dockerode` or Bun Docker API
  - `@safeurl/core` (workspace)
  - `@safeurl/db` (workspace)
  - `@safeurl/mastra` (workspace)
- [x] Set up environment variables
- [x] Configure logging

### Worker Structure

```
apps/worker/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Entry point
│   ├── queue/
│   │   └── processor.ts
│   ├── state/
│   │   └── transitions.ts
│   ├── container/
│   │   └── manager.ts
│   ├── process/
│   │   └── results.ts
│   └── lib/
│       ├── db.ts
│       └── docker.ts
└── .env.example
```

---

## 6.2 Queue Processing (`apps/worker/queue`)

### BullMQ Setup

- [x] **Configure Redis Connection**:
  - [x] Read connection string from environment
  - [x] Set up connection pool
  - [x] Handle connection errors
- [x] **Create Queue Instance**:
  - [x] Queue name: "scan-jobs" (matches API service)
  - [x] Configure queue options
  - [x] Set up queue events
- [x] **Set Up Worker**:
  - [x] Configure worker concurrency
  - [x] Set up job processor
  - [x] Configure retry strategy
- [x] **Retry and Backoff Strategies**:
  - [x] Exponential backoff for failures
  - [x] Max retry attempts
  - [x] Dead-letter queue for failed jobs

### Job Handler

- [x] **Dequeue scan-jobs Jobs**:
  - [x] Process jobs from queue
  - [x] Extract job ID from payload
  - [x] Handle job errors
- [x] **Claim Job from Database**:
  - [x] Fetch job by ID
  - [x] Check current state
  - [x] Use optimistic locking (version field)
  - [x] Handle race conditions
- [x] **Update State: QUEUED → FETCHING**:
  - [x] Atomic state transition
  - [x] Increment version
  - [x] Use database transaction
  - [x] Return Result type

---

## 6.3 State Machine (`apps/worker/state`)

### State Transition Validation

- [x] **Implement Transition Rules**:
  - [x] Define allowed transitions
  - [x] Validate transitions before applying
  - [x] Return error for invalid transitions
- [x] **State Transition Functions**:
  - [x] `transitionToFetching()` - QUEUED → FETCHING
  - [x] `transitionToAnalyzing()` - FETCHING → ANALYZING
  - [x] `transitionToCompleted()` - ANALYZING → COMPLETED
  - [x] `transitionToFailed()` - Any → FAILED
  - [x] `transitionToTimedOut()` - FETCHING/ANALYZING → TIMED_OUT
- [x] **Use Drizzle Transactions**:
  - [x] All state transitions in transactions
  - [x] Ensure atomicity
  - [x] Rollback on error
- [x] **Version Checking**:
  - [x] Check version before update
  - [x] Increment version on update
  - [x] Handle version conflicts
  - [x] Return appropriate errors

### State Transition Schema

- [x] Use Zod schema to validate transitions
- [x] Ensure only valid states are set
- [x] Validate state enum values

---

## 6.4 Container Management (`apps/worker/container`)

### Docker Integration

- [x] **Spawn Ephemeral Fetcher Container**:
  - [x] Use Docker SDK (dockerode)
  - [x] Pull fetcher image if needed
  - [x] Create container with job ID and URL as env vars
  - [x] Configure container limits:
    - Memory limit
    - CPU limit
    - Timeout limit
  - [x] Set `--rm` flag for automatic cleanup
- [x] **Container Configuration**:
  - [x] Network isolation
  - [x] Resource limits
  - [x] Environment variables
  - [x] Volume mounts (if needed)
- [x] **Container Lifecycle**:
  - [x] Start container
  - [x] Monitor container status
  - [x] Handle container timeouts
  - [x] Clean up on completion/error

### Result Collection

- [x] **Read stdout JSON**:
  - [x] Capture container stdout
  - [x] Parse JSON output
  - [x] Handle parsing errors
- [x] **Validate Output**:
  - [x] Validate with Zod schema from `@safeurl/core`
  - [x] Ensure required fields present
  - [x] Verify no content fields
- [x] **Handle Container Failures**:
  - [x] Detect container exit codes
  - [x] Handle timeouts
  - [x] Handle crashes
  - [x] Extract error information
- [x] **Parse and Validate Results**:
  - [x] Use Result types for validation
  - [x] Extract scan results
  - [x] Extract audit log data
  - [x] Handle validation errors

---

## 6.5 Result Processing (`apps/worker/process`)

### Process Scan Results

- [x] **Update State: FETCHING → ANALYZING**:
  - [x] Transition state atomically
  - [x] Increment version
  - [x] Use database transaction
- [x] **Store Scan Results**:
  - [x] Insert into scan_results table
  - [x] Validate all fields
  - [x] Ensure no content is stored
  - [x] Use Result types
- [x] **Write Audit Log Entry**:
  - [x] Create audit log entry (metadata only)
  - [x] Use audit logger from `@safeurl/core`
  - [x] Ensure append-only write
  - [x] Verify no content fields
- [x] **Update State: ANALYZING → COMPLETED**:
  - [x] Final state transition
  - [x] Mark job as complete
  - [x] Update timestamps
- [x] **Handle Errors**:
  - [x] Catch all errors
  - [x] Update state to FAILED
  - [x] Log error details
  - [x] Don't expose sensitive information
- [x] **All Operations Use Result Types**:
  - [x] Wrap all operations in Result
  - [x] Chain operations with `.andThen()`
  - [x] Handle errors explicitly
  - [x] Return appropriate error types

### Error Recovery

- [x] **Retry Logic**:
  - [x] Retry transient failures
  - [x] Don't retry permanent failures
  - [x] Exponential backoff
- [x] **Dead Letter Queue**:
  - [x] Move failed jobs to DLQ (via BullMQ configuration)
  - [x] Log failure reasons
  - [x] Alert on DLQ growth (via BullMQ events)

---

## Success Criteria

- [x] Worker processes jobs from queue
- [x] State transitions work correctly
- [x] Containers spawn and complete successfully
- [x] Results are stored correctly
- [x] Audit logs are created
- [x] Error handling is robust
- [x] No content is persisted
- [x] All operations use Result types
- [x] Optimistic concurrency prevents races

## Additional Implementation

- [x] Dockerfile created for containerization
- [x] Docker Compose configuration added
- [x] Tiltfile updated for local development
- [x] README.md documentation created

---

## Notes

- Use BullMQ's built-in retry mechanisms
- Ensure containers are always cleaned up
- Monitor container resource usage
- Handle Docker daemon failures gracefully
- Keep state transitions atomic
- Log all state changes for debugging
- Test with concurrent workers
