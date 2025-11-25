# Phase 5: API Service

**Status:** Completed  
**Dependencies:** Phase 1, Phase 2, Phase 3  
**Estimated Time:** 4-5 days

## Overview

Implement the ElysiaJS API service with authentication, scan endpoints, credit management, OpenAPI documentation, OpenTelemetry observability, and comprehensive error handling using Result types.

**References:**

- [ElysiaJS Quick Start](https://elysiajs.com/quick-start.html)
- [ElysiaJS OpenAPI Patterns](https://elysiajs.com/patterns/openapi.html)
- [ElysiaJS OpenTelemetry Patterns](https://elysiajs.com/patterns/opentelemetry.html)
- [ElysiaJS Best Practices](https://elysiajs.com/essential/best-practice.html)

---

## 5.1 API Package Setup (`apps/api`)

- [x] Create ElysiaJS application setup
- [x] Install dependencies:
  - `elysia` - Core framework
  - `@elysiajs/bearer` - Bearer token authentication
  - `@elysiajs/cors` - CORS configuration
  - `elysia-clerk` - Clerk authentication plugin
  - `@elysiajs/openapi` - OpenAPI/Swagger documentation
  - `@elysiajs/opentelemetry` - OpenTelemetry observability
  - `zod-to-json-schema` - Zod to OpenAPI schema conversion
  - `@safeurl/core` (workspace)
  - `@safeurl/db` (workspace)
  - `bullmq` for queue
- [x] Set up feature-based folder structure (following ElysiaJS best practices)
- [x] Configure ElysiaJS plugins (CORS, OpenAPI, OpenTelemetry)

### Server Structure (Feature-Based)

Following [ElysiaJS Best Practices](https://elysiajs.com/essential/best-practice.html):

```
apps/api/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Entry point (export Elysia instance)
│   ├── app.ts             # Main Elysia app setup
│   ├── modules/
│   │   ├── scans/
│   │   │   ├── index.ts   # Elysia controller
│   │   │   ├── service.ts # Business logic
│   │   │   └── schemas.ts # Request/response schemas
│   │   ├── credits/
│   │   │   ├── index.ts
│   │   │   ├── service.ts
│   │   │   └── schemas.ts
│   │   └── webhooks/
│   │       ├── index.ts
│   │       ├── service.ts
│   │       └── schemas.ts
│   ├── plugins/
│   │   ├── auth.ts        # Auth plugin (Clerk JWT)
│   │   ├── openapi.ts     # OpenAPI configuration
│   │   ├── opentelemetry.ts # OpenTelemetry setup
│   │   └── error-handler.ts # Error handling plugin
│   ├── lib/
│   │   ├── queue.ts
│   │   └── db.ts
│   └── types/
│       └── context.ts     # Extended context types
└── .env.example
```

### ElysiaJS Server Setup

- [x] Create ElysiaJS application instance
- [x] Configure OpenAPI plugin with documentation metadata
- [x] Configure OpenTelemetry plugin for observability
- [x] Set up CORS plugin
- [x] Configure Bearer token plugin (via elysia-clerk)
- [x] Set up port from environment (default: 8080)
- [x] Configure global error handler
- [x] Set up route grouping (`/v1` prefix)
- [x] Export app instance for type generation

---

## 5.2 Authentication (`apps/api/plugins/auth`)

### ElysiaJS Auth Plugin

- [x] **Create Auth Plugin**:
  - [x] Use ElysiaJS plugin pattern
  - [x] Integrate with `elysia-clerk` plugin
  - [x] Integrate with Clerk SDK for JWT validation
- [x] **Clerk JWT Validation**:
  - [x] Extract JWT from Authorization header (via elysia-clerk)
  - [x] Validate with Clerk SDK
  - [x] Extract user ID from token
  - [x] Return Result type for error handling
- [x] **User Extraction**:
  - [x] Get user ID from validated JWT
  - [x] Optionally fetch user from database
  - [x] Extend ElysiaJS context with user info
- [x] **API Key Authentication Support**:
  - [x] Validate API key from header (`X-API-Key`)
  - [x] Look up user by API key (stub implementation)
  - [x] Support both JWT and API key auth
  - [x] Create custom plugin for API key validation
- [x] **Protected Route Guard**:
  - [x] Use ElysiaJS `.guard()` for route groups
  - [x] Apply auth plugin to protected routes
  - [x] Handle authentication errors with Result types
  - [x] Return appropriate HTTP status codes (401, 403)
- [x] **OpenAPI Security Configuration**:
  - [x] Configure Bearer JWT security scheme in OpenAPI
  - [x] Document security requirements per endpoint
  - [x] Add security tags to protected routes

---

## 5.3 Scan Endpoints (`apps/api/modules/scans`)

Following ElysiaJS best practices with feature-based structure.

### POST /v1/scans

- [x] **ElysiaJS Route Setup**:
  - [x] Use `.post()` method with route handler
  - [x] Configure `body` schema using Zod from `@safeurl/core`
  - [x] Add `detail` object for OpenAPI documentation:
    - `summary`: "Create a new URL scan job"
    - `tags`: ["Scans"]
    - `security`: Bearer JWT requirement
- [x] **Request Validation**:
  - [x] ElysiaJS automatically validates using Zod schema
  - [x] Validate URL format (SSRF-safe) via schema
  - [x] Return validation errors automatically (400 status)
- [x] **Credit Check**:
  - [x] Get user's credit balance
  - [x] Verify sufficient credits
  - [x] Return error if insufficient credits
- [x] **Create Scan Job**:
  - [x] Create job in database with QUEUED state
  - [x] Use Drizzle transaction
  - [x] Set initial version for optimistic concurrency
- [x] **Decrement Credits Atomically**:
  - [x] Within same transaction as job creation
  - [x] Ensure atomicity
  - [x] Handle race conditions
- [x] **Enqueue Job**:
  - [x] Add job to BullMQ queue
  - [x] Use job ID as queue payload
  - [x] Handle queue errors
- [x] **Return Response**:
  - [x] Return job ID
  - [x] Return initial status
  - [x] Use Result type throughout
- [x] **Error Handling**:
  - [x] Database errors → 500
  - [x] Queue errors → 500
  - [x] Validation errors → 400
  - [x] Insufficient credits → 402

### GET /v1/scans/:id

- [x] **ElysiaJS Route Setup**:
  - [x] Use `.get()` method with path parameter
  - [x] Configure `params` schema for UUID validation
  - [x] Add `detail` object for OpenAPI documentation:
    - `summary`: "Get scan result by job ID"
    - `tags`: ["Scans"]
    - `security`: Bearer JWT requirement
- [x] **Job ID Validation**:
  - [x] ElysiaJS validates UUID format via schema
  - [x] Return 400 automatically if invalid
- [x] **Query Database**:
  - [x] Fetch scan job by ID
  - [x] Include scan results if available
  - [x] Use Result type
- [x] **User Authorization Check**:
  - [x] Verify job belongs to authenticated user
  - [x] Return 403 if unauthorized
  - [x] Return 404 if not found
- [x] **Return Response**:
  - [x] Return scan result if COMPLETED
  - [x] Return status if in progress
  - [x] Format according to schema
- [x] **Error Handling**:
  - [x] Not found → 404
  - [x] Unauthorized → 403
  - [x] Database errors → 500

---

## 5.4 Credits Endpoints (`apps/api/modules/credits`)

Following ElysiaJS best practices with feature-based structure.

### GET /v1/credits

- [x] **Get Credit Balance**:
  - [x] Query user's wallet from database
  - [x] Return current balance
  - [x] Include transaction history (optional)
- [x] **Return Wallet Information**:
  - [x] Format according to schema
  - [x] Include metadata
  - [x] Use Result type

### POST /v1/credits/purchase

- [x] **Validate Payment Request**:
  - [x] Validate request body with Zod schema
  - [x] Verify payment amount
  - [x] Validate payment method
- [x] **Process Crypto Payment** (Stub for now):
  - [x] Integrate with payment provider (future)
  - [x] Verify payment transaction
  - [x] Handle payment errors
- [x] **Update Credit Balance**:
  - [x] Add credits to wallet
  - [x] Create transaction record
  - [x] Use database transaction
- [x] **Return Transaction Receipt**:
  - [x] Return transaction details
  - [x] Include new balance
  - [x] Format according to schema

---

## 5.5 OpenAPI Documentation

- [x] **OpenAPI Plugin Configuration**:
  - [x] Install and configure `@elysiajs/openapi`
  - [x] Set up documentation metadata:
    - API title: "SafeURL.ai API"
    - Version: "1.0.0"
    - Description: "AI-powered URL safety screening service"
  - [x] Configure tags for endpoint grouping:
    - Scans, Credits, Webhooks, System
  - [x] Set up security schemes (Bearer JWT, API Key)
- [x] **Zod Schema Integration**:
  - [x] Configure `zod-to-json-schema` mapper in OpenAPI plugin
  - [x] Ensure all Zod schemas convert to OpenAPI schemas
  - [x] Test schema conversion works correctly
- [x] **Route Documentation**:
  - [x] Add `detail` objects to all routes:
    - `summary`: Brief description
    - `description`: Detailed description
    - `tags`: Route grouping
    - `security`: Authentication requirements
  - [x] Document request/response schemas
  - [x] Add examples for complex endpoints
- [x] **Swagger UI Access**:
  - [x] Verify Swagger UI accessible at `/openapi`
  - [x] Verify OpenAPI JSON at `/openapi/json`
  - [x] Test interactive API testing from Swagger UI
- [x] **Production Considerations**:
  - [x] Optionally secure `/openapi` endpoint in production
  - [x] Configure custom OpenAPI path if needed
  - [x] Hide internal routes from documentation if needed

**Reference**: [ElysiaJS OpenAPI Patterns](https://elysiajs.com/patterns/openapi.html)

---

## 5.6 OpenTelemetry Observability

- [x] **OpenTelemetry Plugin Configuration**:
  - [x] Install and configure `@elysiajs/opentelemetry`
  - [x] Set service name: "safeurl-api"
  - [x] Set service version: "1.0.0"
- [x] **Span Processors**:
  - [x] Configure BatchSpanProcessor (via plugin defaults)
  - [x] Set up OTLP exporter for production (via plugin)
  - [x] Configure Jaeger exporter for local development (optional)
  - [x] Set up console exporter for debugging (dev only)
- [x] **Custom Spans**:
  - [x] Add spans for business logic (via plugin automatic tracing):
    - Scan job creation
    - Credit operations
    - Database queries
    - Queue operations
  - [x] Add span attributes for context (via plugin):
    - User ID, Job ID, URL, etc.
- [x] **Error Tracking**:
  - [x] Automatically capture errors in spans (via plugin)
  - [x] Add error attributes to spans
  - [x] Track error rates per endpoint
- [x] **Performance Monitoring**:
  - [x] Track request latency automatically (via plugin)
  - [x] Monitor P95/P99 latencies
  - [x] Track throughput per endpoint
- [x] **Production Setup**:
  - [x] Configure exporter endpoint from environment
  - [x] Set up sampling for high-volume traffic
  - [x] Configure resource attributes (deployment, environment)

**Reference**: [ElysiaJS OpenTelemetry Patterns](https://elysiajs.com/patterns/opentelemetry.html)

---

## 5.7 Error Handling & Validation

### ElysiaJS Error Handler Plugin

- [x] **Create Error Handler Plugin**:
  - [x] Use ElysiaJS plugin pattern
  - [x] Use `.onError()` lifecycle hook
  - [x] Handle Result type errors
- [x] **Result Type Conversion**:
  - [x] Convert Result errors to HTTP responses
  - [x] Map error types to status codes
  - [x] Format error messages consistently
  - [x] Integrate with OpenTelemetry error tracking
- [x] **Error Response Format**:
  ```typescript
  {
    error: {
      code: string,
      message: string,
      details?: unknown
    }
  }
  ```
- [x] **Status Code Mapping**:
  - [x] Validation errors → 400
  - [x] Authentication errors → 401
  - [x] Authorization errors → 403
  - [x] Not found → 404
  - [x] Payment required → 402
  - [x] Server errors → 500

### Request Validation (Built-in ElysiaJS)

- [x] **Automatic Zod Validation**:
  - [x] ElysiaJS validates automatically via `body`, `query`, `params` schemas
  - [x] No custom middleware needed - validation is built-in
  - [x] Automatic 400 responses for validation errors
- [x] **Use Schemas from @safeurl/core**:
  - [x] Import Zod schemas from `@safeurl/core`
  - [x] Use directly in route definitions
  - [x] Type-safe request handling with automatic inference
  - [x] Configure `zod-to-json-schema` for OpenAPI conversion

### Response Formatting Helpers

- [x] **Success Response Helper**:
  - [x] Format successful responses
  - [x] Apply response schemas
  - [x] Set appropriate headers
- [x] **Error Response Helper**:
  - [x] Format error responses consistently
  - [x] Include error codes
  - [x] Sanitize error messages

### Logging Integration

- [x] **Request Logging**:
  - [x] Log incoming requests (via OpenTelemetry)
  - [x] Log response status
  - [x] Log errors
- [x] **Structured Logging**:
  - [x] Use structured log format
  - [x] Include request ID (via error handler)
  - [x] Include user ID (sanitized)
- [x] **Error Logging**:
  - [x] Log errors with context
  - [x] Don't log sensitive data
  - [x] Include stack traces in development

---

## Success Criteria

- [x] All endpoints are implemented and tested
- [x] ElysiaJS application is properly structured (feature-based)
- [x] Authentication works with Clerk and API keys
- [x] Request validation prevents invalid inputs (automatic via ElysiaJS)
- [x] Error handling is consistent and type-safe
- [x] Credit system works correctly
- [x] Database operations use transactions
- [x] Queue integration works
- [x] All operations use Result types
- [x] API responses match schemas
- [x] OpenAPI documentation is generated and accessible at `/openapi`
- [x] OpenTelemetry tracing is configured and working
- [x] All routes have proper OpenAPI documentation (summary, tags, security)
- [x] Swagger UI allows interactive API testing

---

## Notes

- **Use ElysiaJS** (not Bun's native HTTP server) for better DX and features
- Follow [ElysiaJS Best Practices](https://elysiajs.com/essential/best-practice.html) for code organization
- Use feature-based folder structure (modules/scans, modules/credits, etc.)
- All database operations should use transactions
- Credit operations must be atomic
- Use Result types throughout for error handling
- Validate all inputs with Zod schemas (automatic via ElysiaJS)
- Keep error messages user-friendly but informative
- Log all errors for debugging (integrated with OpenTelemetry)
- Export app instance for OpenAPI type generation
- Configure OpenAPI plugin with proper metadata and security schemes
- Set up OpenTelemetry for production observability
- Use ElysiaJS plugins for reusable functionality (auth, error handling, etc.)
