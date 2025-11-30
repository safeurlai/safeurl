# @safeurl/fetcher

Ephemeral container service that safely fetches URLs, performs analysis using Mastra agents, and returns results without persisting any content.

## Overview

The fetcher is a stateless, ephemeral container that:

- Safely fetches URLs with SSRF protection
- Extracts metadata only (no content storage)
- Generates content hashes for audit purposes
- Analyzes URLs using Mastra agents
- Creates audit logs (metadata only)
- Returns structured results via stdout

## Architecture

The fetcher is designed to be completely stateless:

- No persistent storage
- No content persistence
- All content cleared from memory after processing
- Results output to stdout as JSON
- Container removed after execution (`--rm` flag)

## Usage

### Command-Line Arguments

```bash
bun run src/index.ts --job-id <uuid> --url <url> [options]
```

### Environment Variables

```bash
JOB_ID=<uuid> SCAN_URL=<url> FETCH_TIMEOUT_MS=30000 bun run src/index.ts
```

### Options

- `--job-id` / `JOB_ID`: Required. Job ID for tracking
- `--url` / `SCAN_URL`: Required. URL to scan
- `--fetch-timeout-ms` / `FETCH_TIMEOUT_MS`: Optional. Fetch timeout in milliseconds (default: 30000)
- `--max-redirect-depth` / `MAX_REDIRECT_DEPTH`: Optional. Maximum redirect depth (default: 5)

### Docker Usage

```bash
docker run --rm \
  -e JOB_ID=<uuid> \
  -e SCAN_URL=<url> \
  -e OPENROUTER_API_KEY=<your-api-key> \
  safeurl/fetcher:latest
```

**Required Environment Variables:**

- `JOB_ID`: Job ID for tracking
- `SCAN_URL`: URL to scan
- `OPENROUTER_API_KEY`: OpenRouter API key (required for Mastra agent analysis)
  - Get your API key from: https://openrouter.ai/keys
  - Keys should start with `sk-or-v1-` or `sk-or-`

**Optional Environment Variables:**

- `FETCH_TIMEOUT_MS`: Fetch timeout in milliseconds (default: 30000)
- `MAX_REDIRECT_DEPTH`: Maximum redirect depth (default: 5)
- `DEBUG_AGENT`: Enable debug logging (set to `"true"` to enable)

## Output Format

### Success Response

```json
{
  "jobId": "uuid",
  "success": true,
  "result": {
    "riskScore": 0-100,
    "categories": ["malware", "phishing", ...],
    "confidenceScore": 0.0-1.0,
    "reasoning": "Analysis reasoning",
    "indicators": ["indicator1", "indicator2"],
    "contentHash": "sha256-hash",
    "httpStatus": 200,
    "httpHeaders": {...},
    "contentType": "text/html",
    "modelUsed": "model-name",
    "analysisMetadata": {...}
  }
}
```

### Error Response

```json
{
  "jobId": "uuid",
  "success": false,
  "error": {
    "type": "validation" | "network" | "http" | "timeout" | "parse" | "agent",
    "message": "Error message"
  }
}
```

### Exit Codes

- `0`: Success
- `1`: Error (validation, network, http, parse, agent)
- `2`: Timeout

## Security Features

### SSRF Protection

- Validates URLs are public HTTP/HTTPS only
- Rejects private/internal IP addresses
- Rejects localhost and local network addresses
- Validates URL format

### Privacy Protection

- **No content storage**: Only metadata and hashes are stored
- **Memory cleanup**: Content cleared from memory after processing
- **No disk writes**: Container is ephemeral, no files written
- **Audit logging**: Only metadata logged, never content

### Timeout Enforcement

- Configurable fetch timeout (default: 30 seconds)
- AbortController for timeout handling
- Graceful timeout error handling

## Modules

### `fetch/url-fetcher.ts`

Safely fetches URLs with:

- SSRF-safe URL validation
- Timeout enforcement
- Content hash generation
- Metadata extraction (HTML parsing)
- Header sanitization

### `analysis/agent.ts`

Invokes Mastra agent for URL analysis:

- Agent initialization
- Structured output parsing
- Result validation
- Error handling

### `audit/logger.ts`

Creates audit log entries:

- Metadata-only logging
- Schema validation
- Output to stderr (for worker capture)

### `lib/`

Utility modules:

- `hash.ts`: Content hash generation
- `validation.ts`: URL validation helpers

## Development

### Build

```bash
bun run build
```

### Type Check

```bash
bun run typecheck
```

### Run Locally

```bash
bun run dev --job-id test-123 --url https://example.com
```

### Testing

Run the smoke test to verify basic functionality:

```bash
# Set OPENROUTER_API_KEY for full test (required for agent analysis)
export OPENROUTER_API_KEY=your-api-key

# Run smoke test
bun run test:smoke

# Or run all tests
bun test
```

The smoke test verifies:

- ✅ Fetcher runs successfully with valid inputs
- ✅ Produces valid JSON output
- ✅ Validates required parameters (job-id, url)
- ✅ Accepts environment variables (JOB_ID, SCAN_URL)
- ✅ Output structure matches expected schema

## Docker Build

```bash
docker build -t safeurl/fetcher:latest -f apps/fetcher/Dockerfile .
```

## Integration

The fetcher is invoked by the worker service:

1. Worker receives scan job from queue
2. Worker creates ephemeral fetcher container
3. Fetcher processes URL and outputs JSON to stdout
4. Worker captures output and updates scan job
5. Container is removed automatically (`--rm`)

## Notes

- Container must be completely stateless
- All content must be cleared from memory after processing
- Verify no content is written to stdout (only JSON results)
- Test with various URL types (HTTP, HTTPS, redirects)
- Test SSRF protection thoroughly
- Ensure timeouts are enforced
- Keep container image minimal for fast startup
