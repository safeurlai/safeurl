# Phase 5: API Service

**Status:** Not Started  
**Dependencies:** Phase 1, Phase 2, Phase 3  
**Estimated Time:** 4-5 days

## Overview

Implement the Bun HTTP API service with authentication, scan endpoints, credit management, and comprehensive error handling using Result types.

---

## 5.1 API Package Setup (`apps/api`)

- [ ] Create Bun HTTP server setup
- [ ] Install dependencies:
  - `@clerk/clerk-sdk-node` for auth
  - `@safeurl/core` (workspace)
  - `@safeurl/db` (workspace)
  - `bullmq` for queue
- [ ] Set up routing structure
- [ ] Configure middleware (CORS, error handling)

### Server Structure

```
apps/api/
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts          # Entry point
│   ├── routes/
│   │   ├── scans.ts
│   │   ├── credits.ts
│   │   └── health.ts
│   ├── auth/
│   │   └── middleware.ts
│   ├── middleware/
│   │   ├── cors.ts
│   │   ├── error-handler.ts
│   │   └── validation.ts
│   └── lib/
│       ├── queue.ts
│       └── db.ts
└── .env.example
```

### Bun Server Setup

- [ ] Create HTTP server with Bun's native server
- [ ] Configure port from environment
- [ ] Set up request routing
- [ ] Configure CORS middleware
- [ ] Set up global error handler

---

## 5.2 Authentication (`apps/api/auth`)

### Clerk JWT Validation Middleware

- [ ] **JWT Validation**:
  - [ ] Extract JWT from Authorization header
  - [ ] Validate with Clerk SDK
  - [ ] Extract user ID from token
  - [ ] Return Result type
- [ ] **User Extraction**:
  - [ ] Get user ID from validated JWT
  - [ ] Optionally fetch user from database
  - [ ] Attach user to request context
- [ ] **API Key Authentication Support**:
  - [ ] Validate API key from header
  - [ ] Look up user by API key
  - [ ] Support both JWT and API key auth
- [ ] **Protected Route Helper**:
  - [ ] Middleware wrapper for protected routes
  - [ ] Handle authentication errors
  - [ ] Return appropriate HTTP status codes

---

## 5.3 Scan Endpoints (`apps/api/routes/scans`)

### POST /v1/scans

- [ ] **Request Validation**:
  - [ ] Validate request body with Zod schema (`createScanRequest`)
  - [ ] Validate URL format (SSRF-safe)
  - [ ] Return validation errors if invalid
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

- [ ] **Job ID Validation**:
  - [ ] Validate UUID format
  - [ ] Return 400 if invalid
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

## 5.4 Credits Endpoints (`apps/api/routes/credits`)

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

## 5.5 Error Handling & Validation

### Global Error Handler

- [ ] **Result Type Conversion**:
  - [ ] Convert Result errors to HTTP responses
  - [ ] Map error types to status codes
  - [ ] Format error messages consistently
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

### Request Validation Middleware

- [ ] **Zod Schema Validation**:
  - [ ] Validate request body
  - [ ] Validate query parameters
  - [ ] Validate path parameters
  - [ ] Return validation errors
- [ ] **Use Schemas from @safeurl/core**:
  - [ ] Import request schemas
  - [ ] Apply validation middleware
  - [ ] Type-safe request handling

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
- [ ] Authentication works with Clerk and API keys
- [ ] Request validation prevents invalid inputs
- [ ] Error handling is consistent and type-safe
- [ ] Credit system works correctly
- [ ] Database operations use transactions
- [ ] Queue integration works
- [ ] All operations use Result types
- [ ] API responses match schemas

---

## Notes

- Use Bun's native HTTP server for performance
- All database operations should use transactions
- Credit operations must be atomic
- Use Result types throughout for error handling
- Validate all inputs with Zod schemas
- Keep error messages user-friendly but informative
- Log all errors for debugging

