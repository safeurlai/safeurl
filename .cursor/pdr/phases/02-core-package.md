# Phase 2: Core Package Implementation

**Status:** Not Started  
**Dependencies:** Phase 1  
**Estimated Time:** 3-4 days

## Overview

Implement the core shared package with Zod schemas, Result utilities, and audit logging infrastructure.

---

## 2.1 Zod Schemas (`packages/core/schemas`)

### API Schemas (`schemas/api/`)

- [ ] **Request Schemas**:
  - [ ] `createScanRequest` - POST /v1/scans request validation
  - [ ] `getScanRequest` - GET /v1/scans/:id request validation
  - [ ] `purchaseCreditsRequest` - Credit purchase validation
- [ ] **Response Schemas**:
  - [ ] `scanResponse` - Scan result response
  - [ ] `errorResponse` - Standardized error response
  - [ ] `creditBalanceResponse` - Credit balance response
- [ ] **Credit Management Schemas**:
  - [ ] Credit purchase schema
  - [ ] Credit transaction schema
- [ ] Export all schemas from `schemas/api/index.ts`

### Scan Schemas (`schemas/scan/`)

- [ ] **Scan Job State Enum**:
  ```typescript
  z.enum([
    "QUEUED",
    "FETCHING",
    "ANALYZING",
    "COMPLETED",
    "FAILED",
    "TIMED_OUT",
  ]);
  ```
- [ ] **Scan Job Creation Schema**:
  - [ ] URL validation (SSRF-safe)
  - [ ] Optional metadata fields
- [ ] **Scan Result Schema**:
  - [ ] Risk score (0-100)
  - [ ] Categories array
  - [ ] Confidence score
  - [ ] Reasoning text
  - [ ] Indicators array
- [ ] **State Transition Validation Schemas**:
  - [ ] Validate only allowed transitions
  - [ ] Version field for optimistic concurrency
- [ ] Export all schemas from `schemas/scan/index.ts`

### User Schemas (`schemas/user/`)

- [ ] **User Authentication Schemas**:
  - [ ] Clerk user ID validation
  - [ ] JWT payload schema
- [ ] **API Key Schemas**:
  - [ ] API key creation schema
  - [ ] API key validation schema
- [ ] **Credit Wallet Schemas**:
  - [ ] Wallet balance schema
  - [ ] Transaction history schema
- [ ] Export all schemas from `schemas/user/index.ts`

### Schema Exports

- [ ] Create `schemas/index.ts` that exports all schemas
- [ ] Export inferred types using `z.infer`
- [ ] Document schema usage

---

## 2.2 Result Utilities (`packages/core/result`)

### Safe Fetch (`result/safe-fetch.ts`)

- [ ] **Implement `safeFetch`**:
  - [ ] Discriminated error unions:
    - `NetworkError` - Network failures
    - `HttpError<E>` - HTTP error responses (4xx, 5xx)
    - `ParseError` - JSON parsing failures
  - [ ] Return `ResultAsync<T, FetchError<E>>`
  - [ ] Handle fetch promise with `ResultAsync.fromPromise`
  - [ ] Chain HTTP status checking with `.andThen()`
  - [ ] Parse JSON with error handling

### Safe Zod (`result/safe-zod.ts`)

- [ ] **Implement `safeZodParse`**:
  - [ ] Generic function accepting Zod schema
  - [ ] Return `Result<T, ZodParseError<T>>`
  - [ ] Integrate with Zod's `safeParse`
  - [ ] Wrap errors in discriminated union format
- [ ] **ZodParseError Type**:
  ```typescript
  interface ZodParseError<T> {
    type: "zod";
    errors: z.ZodError<T>;
  }
  ```

### Safe Database (`result/safe-db.ts`)

- [ ] **Database Operation Wrappers**:
  - [ ] Wrap Drizzle queries in Result types
  - [ ] Handle database errors explicitly
- [ ] **Transaction Helpers**:
  - [ ] Transaction wrapper with Result return
  - [ ] Rollback on error
- [ ] **Query Error Handling**:
  - [ ] Database connection errors
  - [ ] Query execution errors
  - [ ] Constraint violation errors

### Result Exports

- [ ] Export all utilities from `result/index.ts`
- [ ] Export error type definitions
- [ ] Document usage examples

---

## 2.3 Audit Logging (`packages/core/audit`)

### Audit Schemas (`audit/schemas.ts`)

- [ ] **Audit Log Entry Schema** (Zod):
  - [ ] Log ID (UUID)
  - [ ] Scan job ID (UUID, foreign key)
  - [ ] URL accessed (string, indexed)
  - [ ] Timestamp (ISO 8601)
  - [ ] Content hash (SHA-256)
  - [ ] HTTP status (number)
  - [ ] HTTP headers (object, sanitized)
  - [ ] Content type (MIME string)
  - [ ] Risk assessment summary (object)
  - [ ] **Explicitly exclude**: content body, screenshots, DOM content
- [ ] **Content Hash Validation**:
  - [ ] SHA-256 format validation
  - [ ] Length validation
- [ ] **Metadata-Only Validation**:
  - [ ] Ensure no content fields exist
  - [ ] Runtime validation helper

### Audit Logger (`audit/logger.ts`)

- [ ] **Append-Only Log Writer**:
  - [ ] Interface for audit log storage
  - [ ] Immutable write operations
  - [ ] Atomic write guarantees
- [ ] **Content Hash Generation Utility**:
  - [ ] SHA-256 hash function
  - [ ] Stream-based hashing for large content
  - [ ] Return Result type
- [ ] **Secure Storage Integration Interface**:
  - [ ] Abstract storage interface
  - [ ] Implementation for Turso/libSQL
  - [ ] Future support for other backends
- [ ] **Result-Based Error Handling**:
  - [ ] All operations return Result types
  - [ ] Explicit error types for audit failures

### Audit Exports

- [ ] Export all utilities from `audit/index.ts`
- [ ] Export schema and types
- [ ] Document audit log format

---

## 2.4 Shared Types & Utilities

### Types (`types/`)

- [ ] **Extract Types from Zod Schemas**:
  - [ ] Use `z.infer` for all schemas
  - [ ] Export as TypeScript types
- [ ] **Result Type Helpers**:
  - [ ] Extract success/error types from Result
  - [ ] Type utilities for Result composition
- [ ] **Common Domain Types**:
  - [ ] ScanJobState type
  - [ ] RiskCategory type
  - [ ] User types

### Utils (`utils/`)

- [ ] **Content Hash Utilities**:
  - [ ] SHA-256 hashing function
  - [ ] Stream hashing for large content
- [ ] **URL Validation Helpers**:
  - [ ] SSRF-safe URL validation
  - [ ] URL normalization
  - [ ] Domain extraction
- [ ] **Error Formatters**:
  - [ ] Format Zod errors for API responses
  - [ ] Format Result errors
  - [ ] User-friendly error messages

### Config (`config/`)

- [ ] **Environment Variable Schemas** (Zod):
  - [ ] Database configuration schema
  - [ ] Redis configuration schema
  - [ ] Clerk configuration schema
  - [ ] LLM provider configuration schemas
- [ ] **Configuration Defaults**:
  - [ ] Development defaults
  - [ ] Production defaults
- [ ] **Validation Helpers**:
  - [ ] Validate and load environment variables
  - [ ] Return Result types
  - [ ] Provide helpful error messages

---

## 2.5 Public API Exports

- [ ] Create `index.ts` that exports:
  - [ ] All schemas and types
  - [ ] Result utilities
  - [ ] Audit utilities
  - [ ] Shared types and utils
  - [ ] Configuration helpers
- [ ] Document public API
- [ ] Version the package

---

## Success Criteria

- [ ] All Zod schemas are defined and tested
- [ ] Result utilities work correctly with examples
- [ ] Audit logging schemas prevent content storage
- [ ] Types are properly inferred from schemas
- [ ] Package can be imported and used by other packages
- [ ] All exports are documented

---

## Notes

- Follow the neverthrow patterns from the architecture doc
- Ensure all schemas are strict and validate thoroughly
- Audit schemas must explicitly exclude content fields
- Use discriminated unions for error types
- Keep utilities pure and testable
