# Worker Service

The worker service processes scan jobs from the queue, manages state transitions, spawns ephemeral fetcher containers, and stores results.

## Overview

The worker service is responsible for:

1. **Queue Processing**: Dequeues scan jobs from Redis/BullMQ
2. **State Management**: Manages job state transitions with optimistic locking
3. **Container Execution**: Spawns ephemeral Docker containers to fetch and analyze URLs
4. **Result Storage**: Stores scan results and audit logs in the database

## Architecture

```
┌─────────────┐
│   Redis     │
│   Queue     │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Worker    │────▶│   Container  │────▶│  Database   │
│  Processor  │     │   Manager    │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│   State     │
│ Transitions │
└─────────────┘
```

## State Machine

The worker manages the following state transitions:

- `QUEUED` → `FETCHING`: Job claimed from queue
- `FETCHING` → `ANALYZING`: Container execution completed
- `ANALYZING` → `COMPLETED`: Results stored successfully
- `*` → `FAILED`: Error occurred (any state)
- `FETCHING`/`ANALYZING` → `TIMED_OUT`: Container timeout

All state transitions use optimistic locking with a version field to prevent race conditions.

## Setup

### Prerequisites

- Bun runtime
- Redis server
- Docker daemon
- Database (SQLite/Turso)

### Environment Variables

See `.env.example` for all configuration options:

```bash
# Database
TURSO_CONNECTION_URL=file:./local.db
TURSO_AUTH_TOKEN=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Docker
DOCKER_SOCKET_PATH=/var/run/docker.sock
FETCHER_IMAGE=safeurl-fetcher:latest

# Worker Configuration
WORKER_CONCURRENCY=5
CONTAINER_TIMEOUT_MS=30000
CONTAINER_MEMORY_LIMIT_MB=512
CONTAINER_CPU_LIMIT=0.5
```

### Installation

```bash
# Install dependencies
bun install

# Run in development
bun run dev

# Build for production
bun run build

# Run production build
bun run start
```

## Usage

### Development

```bash
bun run dev
```

### Production

```bash
bun run start
```

## Job Processing Flow

1. **Dequeue Job**: Worker picks up a job from the `scan-jobs` queue
2. **Claim Job**: Transition state from `QUEUED` to `FETCHING` (with version check)
3. **Spawn Container**: Create and run ephemeral fetcher container
4. **Collect Results**: Parse JSON output from container stdout
5. **Store Results**:
   - Transition to `ANALYZING`
   - Insert scan results into database
   - Write audit log entry
   - Transition to `COMPLETED`

## Error Handling

- **Version Conflicts**: Job already claimed by another worker → Skip
- **Container Timeout**: Transition to `TIMED_OUT` or `FAILED`
- **Container Crash**: Transition to `FAILED`
- **Validation Errors**: Transition to `FAILED` (non-retryable)
- **Database Errors**: Retry with exponential backoff

## Container Configuration

Containers are configured with:

- **Memory Limit**: Configurable (default: 512MB)
- **CPU Limit**: Configurable (default: 0.5 cores)
- **Timeout**: Configurable (default: 30 seconds)
- **Auto-remove**: Containers are automatically cleaned up
- **Network Isolation**: Containers run in bridge network mode

## Monitoring

The worker logs:

- Job completion/failure
- State transitions
- Container execution status
- Errors and warnings

## Scaling

Multiple worker instances can run concurrently. BullMQ handles job distribution automatically. Each worker:

- Processes jobs independently
- Uses optimistic locking to prevent conflicts
- Handles graceful shutdown

## Troubleshooting

### Jobs Not Processing

- Check Redis connection
- Verify queue name matches (`scan-jobs`)
- Check worker logs for errors

### Container Failures

- Verify Docker daemon is running
- Check fetcher image exists
- Review container logs in error details

### State Transition Errors

- Check database connection
- Verify job exists and version matches
- Review state transition validation
