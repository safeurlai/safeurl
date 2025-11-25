# Phase 5: API Service

**Status:** Not Started  
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

- [ ] Create ElysiaJS application setup
- [ ] Install dependencies:
  - `elysia` - Core framework
  - `@elysiajs/bearer` - Bearer token authentication
  - `@elysiajs/cors` - CORS configuration
  - `@elysiajs/jwt` - JWT validation (for Clerk)
  - `@elysiajs/openapi` - OpenAPI/Swagger documentation
  - `@elysiajs/opentelemetry` - OpenTelemetry observability
  - `zod-to-json-schema` - Zod to OpenAPI schema conversion
  - `@clerk/clerk-sdk-node` for auth
  - `@safeurl/core` (workspace)
  - `@safeurl/db` (workspace)
  - `bullmq` for queue
- [ ] Set up feature-based folder structure (following ElysiaJS best practices)
- [ ] Configure ElysiaJS plugins (CORS, OpenAPI, OpenTelemetry)

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

- [ ] Create ElysiaJS application instance
- [ ] Configure OpenAPI plugin with documentation metadata
- [ ] Configure OpenTelemetry plugin for observability
- [ ] Set up CORS plugin
- [ ] Configure Bearer token plugin
- [ ] Set up port from environment (default: 8080)
- [ ] Configure global error handler
- [ ] Set up route grouping (`/v1` prefix)
- [ ] Export app instance for type generation

---

## 5.2 Authentication (`apps/api/plugins/auth`)

### ElysiaJS Auth Plugin

- [ ] **Create Auth Plugin**:
  - [ ] Use ElysiaJS plugin pattern
  - [ ] Integrate with `@elysiajs/bearer` plugin
  - [ ] Integrate with `@elysiajs/jwt` for Clerk validation
- [ ] **Clerk JWT Validation**:
  - [ ] Extract JWT from Authorization header (via bearer plugin)
  - [ ] Validate with Clerk SDK
  - [ ] Extract user ID from token
  - [ ] Return Result type for error handling
- [ ] **User Extraction**:
  - [ ] Get user ID from validated JWT
  - [ ] Optionally fetch user from database
  - [ ] Extend ElysiaJS context with user info
- [ ] **API Key Authentication Support**:
  - [ ] Validate API key from header (`X-API-Key`)
  - [ ] Look up user by API key
  - [ ] Support both JWT and API key auth
  - [ ] Create custom plugin for API key validation
- [ ] **Protected Route Guard**:
  - [ ] Use ElysiaJS `.guard()` for route groups
  - [ ] Apply auth plugin to protected routes
  - [ ] Handle authentication errors with Result types
  - [ ] Return appropriate HTTP status codes (401, 403)
- [ ] **OpenAPI Security Configuration**:
  - [ ] Configure Bearer JWT security scheme in OpenAPI
  - [ ] Document security requirements per endpoint
  - [ ] Add security tags to protected routes

---

## 5.3 Scan Endpoints (`apps/api/modules/scans`)

Following ElysiaJS best practices with feature-based structure.

### POST /v1/scans

- [ ] **ElysiaJS Route Setup**:
  - [ ] Use `.post()` method with route handler
  - [ ] Configure `body` schema using Zod from `@safeurl/core`
  - [ ] Add `detail` object for OpenAPI documentation:
    - `summary`: "Create a new URL scan job"
    - `tags`: ["Scans"]
    - `security`: Bearer JWT requirement
- [ ] **Request Validation**:
  - [ ] ElysiaJS automatically validates using Zod schema
  - [ ] Validate URL format (SSRF-safe) via schema
  - [ ] Return validation errors automatically (400 status)
- [ ] **Credit Check**:
  - [ ] Get user's credit balance
  - [ ] Verify sufficient credits
  - [ ] Return error if insufficient credits
- [ ] **Create Scan Job**:
  - [ ] Create job in database with QUEUED state
  - [ ] Use Drizzle transaction
  - [ ] Set initial version for optimistic concurrency
- [ ] **Decrement Credits Atomically**:
  - [ ] Within same transaction as job creation
  - [ ] Ensure atomicity
  - [ ] Handle race conditions
- [ ] **Enqueue Job**:
  - [ ] Add job to BullMQ queue
  - [ ] Use job ID as queue payload
  - [ ] Handle queue errors
- [ ] **Return Response**:
  - [ ] Return job ID
  - [ ] Return initial status
  - [ ] Use Result type throughout
- [ ] **Error Handling**:
  - [ ] Database errors → 500
  - [ ] Queue errors → 500
  - [ ] Validation errors → 400
  - [ ] Insufficient credits → 402

### GET /v1/scans/:id

- [ ] **ElysiaJS Route Setup**:
  - [ ] Use `.get()` method with path parameter
  - [ ] Configure `params` schema for UUID validation
  - [ ] Add `detail` object for OpenAPI documentation:
    - `summary`: "Get scan result by job ID"
    - `tags`: ["Scans"]
    - `security`: Bearer JWT requirement
- [ ] **Job ID Validation**:
  - [ ] ElysiaJS validates UUID format via schema
  - [ ] Return 400 automatically if invalid
- [ ] **Query Database**:
  - [ ] Fetch scan job by ID
  - [ ] Include scan results if available
  - [ ] Use Result type
- [ ] **User Authorization Check**:
  - [ ] Verify job belongs to authenticated user
  - [ ] Return 403 if unauthorized
  - [ ] Return 404 if not found
- [ ] **Return Response**:
  - [ ] Return scan result if COMPLETED
  - [ ] Return status if in progress
  - [ ] Format according to schema
- [ ] **Error Handling**:
  - [ ] Not found → 404
  - [ ] Unauthorized → 403
  - [ ] Database errors → 500

---

## 5.4 Credits Endpoints (`apps/api/modules/credits`)

Following ElysiaJS best practices with feature-based structure.

### GET /v1/credits

- [ ] **Get Credit Balance**:
  - [ ] Query user's wallet from database
  - [ ] Return current balance
  - [ ] Include transaction history (optional)
- [ ] **Return Wallet Information**:
  - [ ] Format according to schema
  - [ ] Include metadata
  - [ ] Use Result type

### POST /v1/credits/purchase

- [ ] **Validate Payment Request**:
  - [ ] Validate request body with Zod schema
  - [ ] Verify payment amount
  - [ ] Validate payment method
- [ ] **Process Crypto Payment** (Stub for now):
  - [ ] Integrate with payment provider (future)
  - [ ] Verify payment transaction
  - [ ] Handle payment errors
- [ ] **Update Credit Balance**:
  - [ ] Add credits to wallet
  - [ ] Create transaction record
  - [ ] Use database transaction
- [ ] **Return Transaction Receipt**:
  - [ ] Return transaction details
  - [ ] Include new balance
  - [ ] Format according to schema

---

## 5.5 OpenAPI Documentation

- [ ] **OpenAPI Plugin Configuration**:
  - [ ] Install and configure `@elysiajs/openapi`
  - [ ] Set up documentation metadata:
    - API title: "SafeURL.ai API"
    - Version: "1.0.0"
    - Description: "AI-powered URL safety screening service"
  - [ ] Configure tags for endpoint grouping:
    - Scans, Credits, Webhooks, System
  - [ ] Set up security schemes (Bearer JWT)
- [ ] **Zod Schema Integration**:
  - [ ] Configure `zod-to-json-schema` mapper in OpenAPI plugin
  - [ ] Ensure all Zod schemas convert to OpenAPI schemas
  - [ ] Test schema conversion works correctly
- [ ] **Route Documentation**:
  - [ ] Add `detail` objects to all routes:
    - `summary`: Brief description
    - `description`: Detailed description
    - `tags`: Route grouping
    - `security`: Authentication requirements
  - [ ] Document request/response schemas
  - [ ] Add examples for complex endpoints
- [ ] **Swagger UI Access**:
  - [ ] Verify Swagger UI accessible at `/openapi`
  - [ ] Verify OpenAPI JSON at `/openapi/json`
  - [ ] Test interactive API testing from Swagger UI
- [ ] **Production Considerations**:
  - [ ] Optionally secure `/openapi` endpoint in production
  - [ ] Configure custom OpenAPI path if needed
  - [ ] Hide internal routes from documentation if needed

**Reference**: [ElysiaJS OpenAPI Patterns](https://elysiajs.com/patterns/openapi.html)

---

## 5.6 OpenTelemetry Observability

- [ ] **OpenTelemetry Plugin Configuration**:
  - [ ] Install and configure `@elysiajs/opentelemetry`
  - [ ] Set service name: "safeurl-api"
  - [ ] Set service version: "1.0.0"
- [ ] **Span Processors**:
  - [ ] Configure BatchSpanProcessor
  - [ ] Set up OTLP exporter for production
  - [ ] Configure Jaeger exporter for local development (optional)
  - [ ] Set up console exporter for debugging (dev only)
- [ ] **Custom Spans**:
  - [ ] Add spans for business logic:
    - Scan job creation
    - Credit operations
    - Database queries
    - Queue operations
  - [ ] Add span attributes for context:
    - User ID, Job ID, URL, etc.
- [ ] **Error Tracking**:
  - [ ] Automatically capture errors in spans
  - [ ] Add error attributes to spans
  - [ ] Track error rates per endpoint
- [ ] **Performance Monitoring**:
  - [ ] Track request latency automatically
  - [ ] Monitor P95/P99 latencies
  - [ ] Track throughput per endpoint
- [ ] **Production Setup**:
  - [ ] Configure exporter endpoint from environment
  - [ ] Set up sampling for high-volume traffic
  - [ ] Configure resource attributes (deployment, environment)

**Reference**: [ElysiaJS OpenTelemetry Patterns](https://elysiajs.com/patterns/opentelemetry.html)

---

## 5.7 Error Handling & Validation

### ElysiaJS Error Handler Plugin

- [ ] **Create Error Handler Plugin**:
  - [ ] Use ElysiaJS plugin pattern
  - [ ] Use `.onError()` lifecycle hook
  - [ ] Handle Result type errors
- [ ] **Result Type Conversion**:
  - [ ] Convert Result errors to HTTP responses
  - [ ] Map error types to status codes
  - [ ] Format error messages consistently
  - [ ] Integrate with OpenTelemetry error tracking
- [ ] **Error Response Format**:
  ```typescript
  {
    error: {
      code: string,
      message: string,
      details?: unknown
    }
  }
  ```
- [ ] **Status Code Mapping**:
  - [ ] Validation errors → 400
  - [ ] Authentication errors → 401
  - [ ] Authorization errors → 403
  - [ ] Not found → 404
  - [ ] Payment required → 402
  - [ ] Server errors → 500

### Request Validation (Built-in ElysiaJS)

- [ ] **Automatic Zod Validation**:
  - [ ] ElysiaJS validates automatically via `body`, `query`, `params` schemas
  - [ ] No custom middleware needed - validation is built-in
  - [ ] Automatic 400 responses for validation errors
- [ ] **Use Schemas from @safeurl/core**:
  - [ ] Import Zod schemas from `@safeurl/core`
  - [ ] Use directly in route definitions
  - [ ] Type-safe request handling with automatic inference
  - [ ] Configure `zod-to-json-schema` for OpenAPI conversion

### Response Formatting Helpers

- [ ] **Success Response Helper**:
  - [ ] Format successful responses
  - [ ] Apply response schemas
  - [ ] Set appropriate headers
- [ ] **Error Response Helper**:
  - [ ] Format error responses consistently
  - [ ] Include error codes
  - [ ] Sanitize error messages

### Logging Integration

- [ ] **Request Logging**:
  - [ ] Log incoming requests
  - [ ] Log response status
  - [ ] Log errors
- [ ] **Structured Logging**:
  - [ ] Use structured log format
  - [ ] Include request ID
  - [ ] Include user ID (sanitized)
- [ ] **Error Logging**:
  - [ ] Log errors with context
  - [ ] Don't log sensitive data
  - [ ] Include stack traces in development

---

## Success Criteria

- [ ] All endpoints are implemented and tested
- [ ] ElysiaJS application is properly structured (feature-based)
- [ ] Authentication works with Clerk and API keys
- [ ] Request validation prevents invalid inputs (automatic via ElysiaJS)
- [ ] Error handling is consistent and type-safe
- [ ] Credit system works correctly
- [ ] Database operations use transactions
- [ ] Queue integration works
- [ ] All operations use Result types
- [ ] API responses match schemas
- [ ] OpenAPI documentation is generated and accessible at `/openapi`
- [ ] OpenTelemetry tracing is configured and working
- [ ] All routes have proper OpenAPI documentation (summary, tags, security)
- [ ] Swagger UI allows interactive API testing

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

