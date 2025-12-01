# Worker-CF

Cloudflare Worker that processes scan jobs from the queue. This worker orchestrates the scan process by:

1. Consuming messages from the `scan-jobs` queue
2. Managing state transitions (QUEUED → FETCHING → ANALYZING → COMPLETED)
3. Calling `fetcher-cf` to fetch URLs and analyze them
4. Processing and storing results in the database
5. Writing audit logs

## Architecture

This worker separates concerns from the original `fetcher-cf` implementation:

- **worker-cf**: Queue consumer, state management, result processing
- **fetcher-cf**: Pure fetching and analysis functionality (used as a library)

## Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Set up secrets:
   ```bash
   wrangler secret put TURSO_CONNECTION_URL
   wrangler secret put TURSO_AUTH_TOKEN
   wrangler secret put OPENROUTER_API_KEY
   ```

3. Run locally:
   ```bash
   bun run dev
   ```

4. Deploy:
   ```bash
   bun run deploy
   ```

## Configuration

See `wrangler.jsonc` for configuration options including:
- Queue consumer settings
- CPU time limits
- Browser bindings for Cloudflare Playwright

## Environment Variables

- `FETCH_TIMEOUT_MS`: Timeout for URL fetching (default: 30000)
- `MAX_REDIRECT_DEPTH`: Maximum redirect depth (default: 5)

## Queue Configuration

The worker consumes from the `scan-jobs` queue with:
- Max batch size: 10
- Max batch timeout: 30 seconds
- Max retries: 3
- Dead letter queue: `scan-jobs-dlq`
