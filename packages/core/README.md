# @safeurl/core

Shared core package providing runtime validation, type-safe error handling, and utilities for all SafeURL services.

## Features

- **Zod Schemas**: Centralized runtime validation for API requests/responses, scan jobs, and user data
- **Functional Error Handling**: neverthrow `Result<T, E>` wrappers for explicit, type-safe error handling
- **Safe Utilities**: Type-safe wrappers for fetch, Zod parsing, and database operations
- **Audit Logging**: Compliance-focused audit logging with content hashing (metadata-only)
- **Configuration**: Environment variable validation and type-safe config loading
- **URL Utilities**: SSRF-safe URL validation and normalization helpers

## Installation

```bash
# In monorepo root
bun install
```

## Usage

### Schemas

```typescript
import { createScanRequestSchema, ScanResponse } from "@safeurl/core";

// Validate request data
const result = createScanRequestSchema.safeParse({
  url: "https://example.com",
});
if (result.success) {
  const data = result.data; // Type-safe!
}
```

### Result Types (neverthrow)

```typescript
import { safeFetch, safeZodParse, Result } from "@safeurl/core";

// Type-safe fetch with discriminated errors
const result = await safeFetch<{ data: string }>(
  "https://api.example.com/data"
);
result.match(
  (data) => console.log("Success:", data),
  (error) => {
    if (error.type === "network") {
      console.error("Network error");
    } else if (error.type === "http") {
      console.error("HTTP error:", error.status);
    }
  }
);

// Type-safe Zod parsing
const parseResult = safeZodParse(userSchema, userData);
if (parseResult.isOk()) {
  const user = parseResult.value; // Type-safe!
}
```

### URL Validation

```typescript
import { validateSsrfSafeUrl, normalizeUrl } from "@safeurl/core";

// SSRF-safe URL validation
const urlResult = validateSsrfSafeUrl("https://example.com");
if (urlResult.isOk()) {
  const safeUrl = urlResult.value;
}

// URL normalization
const normalized = normalizeUrl("https://example.com/path?b=2&a=1#fragment");
```

### Audit Logging

```typescript
import { createAuditLogger, generateContentHash } from "@safeurl/core";

// Generate content hash (for verification without storing content)
const hashResult = await generateContentHash("content string");
if (hashResult.isOk()) {
  const hash = hashResult.value; // SHA-256 hash
}

// Create audit logger
const logger = createAuditLogger({ storage: auditStorage });
await logger.log({
  scanJobId: "job-123",
  url: "https://example.com",
  contentHash: hash,
  // ... metadata only, no actual content
});
```

### Configuration

```typescript
import { loadEnvConfig, EnvConfig } from "@safeurl/core";

// Load and validate environment variables
const configResult = loadEnvConfig(process.env);
if (configResult.isOk()) {
  const config: EnvConfig = configResult.value;
  // Use validated config...
}
```

## Package Exports

The package provides multiple entry points:

```typescript
// Main exports
import { ... } from "@safeurl/core";

// Specific modules
import { ... } from "@safeurl/core/schemas";
import { ... } from "@safeurl/core/result";
import { ... } from "@safeurl/core/audit";
import { ... } from "@safeurl/core/types";
import { ... } from "@safeurl/core/utils";
import { ... } from "@safeurl/core/config";
```

## Project Structure

```
src/
├── schemas/          # Zod validation schemas
│   ├── api/         # API request/response schemas
│   ├── scan/        # Scan job schemas
│   └── user/        # User & auth schemas
├── result/          # neverthrow wrappers
│   ├── safe-fetch.ts    # Type-safe HTTP client
│   ├── safe-zod.ts      # Zod parsing with Result types
│   └── safe-db.ts       # Database operation wrappers
├── audit/           # Audit logging utilities
│   ├── logger.ts        # Audit log writer
│   └── schemas.ts       # Audit log schemas
├── config/          # Configuration management
│   └── index.ts         # Env var validation & loading
├── utils/           # Shared utilities
│   └── index.ts         # URL validation, error formatting
└── types/           # TypeScript type definitions
    └── index.ts         # Exported types & helpers
```

## Key Concepts

### Functional Error Handling

All failable operations return `Result<T, E>` or `ResultAsync<T, E>` types:

- **Explicit Errors**: Errors are part of the type system, not exceptions
- **Type Safety**: Discriminated error unions enable exhaustive error handling
- **Composability**: Chain operations with `.andThen()`, `.map()`, `.orElse()`

### Runtime Validation

Zod schemas provide:

- **Type Inference**: TypeScript types derived from schemas
- **Runtime Safety**: Validate data at runtime, not just compile time
- **Error Messages**: Detailed validation errors for debugging

### Privacy-First Design

Audit logging stores **metadata only**:

- Content hashes for verification (not actual content)
- URL metadata, timestamps, risk assessments
- No unsafe/illegal content persistence
- Compliance-ready audit trails

## Dependencies

- `zod` - Runtime validation and type inference
- `neverthrow` - Functional error handling with Result types
- `zod-to-json-schema` - OpenAPI schema generation

## Development

```bash
# Type checking
bun run typecheck

# Linting (when configured)
bun run lint
```

## Used By

This package is consumed by:

- `@safeurl/api` - API service
- `@safeurl/worker` - Worker service
- `@safeurl/fetcher` - Fetcher container
- `@safeurl/dashboard` - Dashboard application

All services share the same validation schemas and error handling patterns for consistency and type safety across the monorepo.
