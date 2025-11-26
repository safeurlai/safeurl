# Worker Testing Guide

This guide explains how to test that the worker is functioning correctly.

## Quick Test (Manual)

The easiest way to verify the worker is working:

### Step 1: Start Redis

```bash
# Option 1: Using Docker Compose
docker-compose up -d redis

# Option 2: Local Redis
redis-server
```

### Step 2: Start Worker

In one terminal, start the worker:

```bash
cd apps/worker
bun dev
```

You should see:

```
Starting worker service...
Worker service started and ready to process jobs
Concurrency: 5
Fetcher image: safeurl-fetcher:latest
```

### Step 3: Run Manual Test

In another terminal, run the manual test script:

```bash
cd apps/worker
bun run test:manual
```

This will:

1. Create a test job in the database
2. Add it to the queue
3. Monitor the worker processing it
4. Report the final state

**Expected output:**

```
🧪 Manual Worker Test
====================

✅ Connected to Redis
✅ Test user setup complete

📝 Creating test job...
✅ Created job: <job-id>
   URL: https://example.com
   State: QUEUED

📤 Adding job to queue...
✅ Job added to queue: <queue-job-id>

👀 Monitoring job state (checking every 2 seconds)...
   Make sure the worker is running in another terminal!

   State changed: QUEUED → FETCHING
   State changed: FETCHING → ANALYZING
   State changed: ANALYZING → COMPLETED

✅ SUCCESS! Job completed successfully!
   Final state: COMPLETED

✨ Test complete!
```

## Automated Tests

Run the full test suite:

```bash
cd apps/worker
bun test
```

Or run just the worker tests:

```bash
bun run test:worker
```

## What the Tests Verify

### 1. Worker Connection Test

- ✅ Worker can connect to Redis
- ✅ Worker is running and active

### 2. Job Processing Test

- ✅ Worker picks up jobs from the queue
- ✅ Job state transitions from QUEUED to another state
- ✅ Worker processes jobs correctly

### 3. Event Handling Test

- ✅ Worker emits completion/failure events
- ✅ Event handlers are working

## Troubleshooting

### Worker Not Processing Jobs

**Check Redis connection:**

```bash
redis-cli ping
# Should return: PONG
```

**Check worker logs:**
Look for errors in the worker terminal:

- Connection errors
- Docker errors
- Database errors

**Check queue status:**

```bash
# Using Redis CLI
redis-cli
> LLEN bull:scan-jobs:wait
> LLEN bull:scan-jobs:active
```

### Jobs Stuck in QUEUED

1. **Worker not running**: Start the worker
2. **Redis connection issue**: Check Redis is accessible
3. **Queue name mismatch**: Ensure worker and API use same queue name (`scan-jobs`)

### Jobs Failing

Check worker logs for:

- Container execution errors
- Database errors
- State transition errors

### Database Errors

Ensure:

- Database migrations are run: `bun run db:migrate`
- Database is accessible: Check `DATABASE_URL` environment variable
- Tables exist: Check database schema

## Integration Test (Full Flow)

For a complete end-to-end test, use the API integration test:

```bash
cd apps/api
bun test src/modules/scans/scan.integration.test.ts
```

This test:

1. Creates a scan job via API
2. Worker processes it
3. Verifies the complete result

## Monitoring Worker Health

### Check Worker Status

```bash
# Worker should be running and connected
# Check logs for: "Worker service started and ready to process jobs"
```

### Monitor Queue

```bash
# Using Redis CLI
redis-cli
> KEYS bull:scan-jobs:*
> GET bull:scan-jobs:meta
```

### Check Job States

Query the database:

```sql
SELECT state, COUNT(*)
FROM scan_jobs
GROUP BY state;
```

## Performance Testing

To test worker performance:

1. **Create multiple jobs:**

```bash
# Use the API to create multiple scan jobs
for i in {1..10}; do
  curl -X POST http://localhost:8080/v1/scans \
    -H "Content-Type: application/json" \
    -d '{"url": "https://example.com"}'
done
```

2. **Monitor processing:**
   Watch the worker logs and database to see jobs being processed.

3. **Check concurrency:**
   Worker processes jobs based on `WORKER_CONCURRENCY` (default: 5).

## Next Steps

- ✅ Worker is processing jobs
- ✅ Jobs complete successfully
- ✅ Results are stored in database
- ✅ State transitions work correctly

If all tests pass, your worker is functioning correctly! 🎉
