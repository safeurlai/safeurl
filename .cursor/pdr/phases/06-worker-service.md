# Phase 6: Worker Service

**Status:** Not Started  
**Dependencies:** Phase 1, Phase 2, Phase 3, Phase 4, Phase 5  
**Estimated Time:** 4-5 days

## Overview

Implement the worker service that processes scan jobs from the queue, manages state transitions, spawns fetcher containers, and stores results.

---

## 6.1 Worker Package Setup (`apps/worker`)

- [ ] Create worker entry point
- [ ] Install dependencies:
  - `bullmq` for queue processing
  - `dockerode` or Bun Docker API
  - `@safeurl/core` (workspace)
  - `@safeurl/db` (workspace)
  - `@safeurl/mastra` (workspace)
- [ ] Set up environment variables
- [ ] Configure logging

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

- [ ] **Configure Redis Connection**:
  - [ ] Read connection string from environment
  - [ ] Set up connection pool
  - [ ] Handle connection errors
- [ ] **Create Queue Instance**:
  - [ ] Queue name: "scan:url"
  - [ ] Configure queue options
  - [ ] Set up queue events
- [ ] **Set Up Worker**:
  - [ ] Configure worker concurrency
  - [ ] Set up job processor
  - [ ] Configure retry strategy
- [ ] **Retry and Backoff Strategies**:
  - [ ] Exponential backoff for failures
  - [ ] Max retry attempts
  - [ ] Dead-letter queue for failed jobs

### Job Handler

- [ ] **Dequeue scan:url Jobs**:
  - [ ] Process jobs from queue
  - [ ] Extract job ID from payload
  - [ ] Handle job errors
- [ ] **Claim Job from Database**:
  - [ ] Fetch job by ID
  - [ ] Check current state
  - [ ] Use optimistic locking (version field)
  - [ ] Handle race conditions
- [ ] **Update State: QUEUED → FETCHING**:
  - [ ] Atomic state transition
  - [ ] Increment version
  - [ ] Use database transaction
  - [ ] Return Result type

---

## 6.3 State Machine (`apps/worker/state`)

### State Transition Validation

- [ ] **Implement Transition Rules**:
  - [ ] Define allowed transitions
  - [ ] Validate transitions before applying
  - [ ] Return error for invalid transitions
- [ ] **State Transition Functions**:
  - [ ] `transitionToFetching()` - QUEUED → FETCHING
  - [ ] `transitionToAnalyzing()` - FETCHING → ANALYZING
  - [ ] `transitionToCompleted()` - ANALYZING → COMPLETED
  - [ ] `transitionToFailed()` - Any → FAILED
  - [ ] `transitionToTimedOut()` - FETCHING/ANALYZING → TIMED_OUT
- [ ] **Use Drizzle Transactions**:
  - [ ] All state transitions in transactions
  - [ ] Ensure atomicity
  - [ ] Rollback on error
- [ ] **Version Checking**:
  - [ ] Check version before update
  - [ ] Increment version on update
  - [ ] Handle version conflicts
  - [ ] Return appropriate errors

### State Transition Schema

- [ ] Use Zod schema to validate transitions
- [ ] Ensure only valid states are set
- [ ] Validate state enum values

---

## 6.4 Container Management (`apps/worker/container`)

### Docker Integration

- [ ] **Spawn Ephemeral Fetcher Container**:
  - [ ] Use Docker SDK (dockerode or Bun API)
  - [ ] Pull fetcher image if needed
  - [ ] Create container with job ID and URL as env vars
  - [ ] Configure container limits:
    - Memory limit
    - CPU limit
    - Timeout limit
  - [ ] Set `--rm` flag for automatic cleanup
- [ ] **Container Configuration**:
  - [ ] Network isolation
  - [ ] Resource limits
  - [ ] Environment variables
  - [ ] Volume mounts (if needed)
- [ ] **Container Lifecycle**:
  - [ ] Start container
  - [ ] Monitor container status
  - [ ] Handle container timeouts
  - [ ] Clean up on completion/error

### Result Collection

- [ ] **Read stdout JSON**:
  - [ ] Capture container stdout
  - [ ] Parse JSON output
  - [ ] Handle parsing errors
- [ ] **Validate Output**:
  - [ ] Validate with Zod schema from `@safeurl/core`
  - [ ] Ensure required fields present
  - [ ] Verify no content fields
- [ ] **Handle Container Failures**:
  - [ ] Detect container exit codes
  - [ ] Handle timeouts
  - [ ] Handle crashes
  - [ ] Extract error information
- [ ] **Parse and Validate Results**:
  - [ ] Use Result types for validation
  - [ ] Extract scan results
  - [ ] Extract audit log data
  - [ ] Handle validation errors

---

## 6.5 Result Processing (`apps/worker/process`)

### Process Scan Results

- [ ] **Update State: FETCHING → ANALYZING**:
  - [ ] Transition state atomically
  - [ ] Increment version
  - [ ] Use database transaction
- [ ] **Store Scan Results**:
  - [ ] Insert into scan_results table
  - [ ] Validate all fields
  - [ ] Ensure no content is stored
  - [ ] Use Result types
- [ ] **Write Audit Log Entry**:
  - [ ] Create audit log entry (metadata only)
  - [ ] Use audit logger from `@safeurl/core`
  - [ ] Ensure append-only write
  - [ ] Verify no content fields
- [ ] **Update State: ANALYZING → COMPLETED**:
  - [ ] Final state transition
  - [ ] Mark job as complete
  - [ ] Update timestamps
- [ ] **Handle Errors**:
  - [ ] Catch all errors
  - [ ] Update state to FAILED
  - [ ] Log error details
  - [ ] Don't expose sensitive information
- [ ] **All Operations Use Result Types**:
  - [ ] Wrap all operations in Result
  - [ ] Chain operations with `.andThen()`
  - [ ] Handle errors explicitly
  - [ ] Return appropriate error types

### Error Recovery

- [ ] **Retry Logic**:
  - [ ] Retry transient failures
  - [ ] Don't retry permanent failures
  - [ ] Exponential backoff
- [ ] **Dead Letter Queue**:
  - [ ] Move failed jobs to DLQ
  - [ ] Log failure reasons
  - [ ] Alert on DLQ growth

---

## Success Criteria

- [ ] Worker processes jobs from queue
- [ ] State transitions work correctly
- [ ] Containers spawn and complete successfully
- [ ] Results are stored correctly
- [ ] Audit logs are created
- [ ] Error handling is robust
- [ ] No content is persisted
- [ ] All operations use Result types
- [ ] Optimistic concurrency prevents races

---

## Notes

- Use BullMQ's built-in retry mechanisms
- Ensure containers are always cleaned up
- Monitor container resource usage
- Handle Docker daemon failures gracefully
- Keep state transitions atomic
- Log all state changes for debugging
- Test with concurrent workers

