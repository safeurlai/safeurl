# Fetcher-CF

Cloudflare Worker library for URL fetching and AI-powered analysis. This package provides pure fetching and analysis functionality that can be used by other workers (like `worker-cf`) or deployed as a standalone service.

## Purpose

This worker has been refactored to separate concerns:

- **fetcher-cf**: Pure fetching and analysis functionality (this package)
- **worker-cf**: Queue consumer, state management, result processing

## Features

- **URL Fetching**: SSRF-safe URL fetching with metadata extraction
- **AI Analysis**: Mastra agent integration for risk assessment
- **Browser Support**: Cloudflare Playwright integration for screenshot analysis
- **Library Export**: Can be imported and used by other workers

## Usage as a Library

Import and use in other workers:

```typescript
import { fetchUrl } from "@safeurl/fetcher-cf/fetch/url-fetcher";
import { analyzeWithAgent } from "@safeurl/fetcher-cf/analysis/agent";

// Fetch a URL
const fetchResult = await fetchUrl(url, {
  timeoutMs: 30000,
  maxRedirectDepth: 5,
});

// Analyze with AI agent
const analysisResult = await analyzeWithAgent(
  {
    url,
    contentHash: fetchData.contentHash,
    httpStatus: fetchData.httpStatus,
    httpHeaders: fetchData.httpHeaders,
    contentType: fetchData.contentType,
    metadata: fetchData.metadata,
  },
  {
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
    MYBROWSER: env.MYBROWSER,
  }
);
```

## Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Set up secrets (if deploying as standalone):
   ```bash
   wrangler secret put OPENROUTER_API_KEY
   ```

3. Run locally:
   ```bash
   bun run dev
   ```

4. Deploy (if deploying as standalone):
   ```bash
   bun run deploy
   ```

## Configuration

See `wrangler.jsonc` for configuration options including:
- Browser bindings for Cloudflare Playwright
- CPU time limits
- Environment variables

## Privacy & Legal Compliance

**CRITICAL: Screenshots are NEVER stored**

- Screenshots are captured in-memory using Cloudflare Playwright
- Converted to base64 for vision model API calls
- Immediately discarded after analysis
- Only screenshot hash is persisted for deduplication/audit
- No image data, no base64 strings stored in database

## Exports

The package exports:

- `fetchUrl`: URL fetching function
- `analyzeWithAgent`: AI analysis function
- Type definitions for all interfaces

See `src/index.ts` for the full export list.