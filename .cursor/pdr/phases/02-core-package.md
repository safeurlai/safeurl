# Phase 2: Core Package Implementation

**Status:** Complete  
**Dependencies:** Phase 1  
**Estimated Time:** 3-4 days

## Overview

Implement the core shared package with Zod schemas, Result utilities, and audit logging infrastructure.

---

## 2.1 Zod Schemas (`packages/core/schemas`)

### API Schemas (`schemas/api/`)

- [x] **Request Schemas**:
  - [x] `createScanRequest` - POST /v1/scans request validation
  - [x] `getScanRequest` - GET /v1/scans/:id request validation
  - [x] `purchaseCreditsRequest` - Credit purchase validation
- [x] **Response Schemas**:
  - [x] `scanResponse` - Scan result response
  - [x] `errorResponse` - Standardized error response
  - [x] `creditBalanceResponse` - Credit balance response
- [x] **Credit Management Schemas**:
  - [x] Credit purchase schema
  - [x] Credit transaction schema
- [x] Export all schemas from `schemas/api/index.ts`

### Scan Schemas (`schemas/scan/`)

- [x] **Scan Job State Enum**:
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
- [x] **Scan Job Creation Schema**:
  - [x] URL validation (SSRF-safe)
  - [x] Optional metadata fields
- [x] **Scan Result Schema**:
  - [x] Risk score (0-100)
  - [x] Categories array
  - [x] Confidence score
  - [x] Reasoning text
  - [x] Indicators array
- [x] **State Transition Validation Schemas**:
  - [x] Validate only allowed transitions
  - [x] Version field for optimistic concurrency
- [x] Export all schemas from `schemas/scan/index.ts`

### User Schemas (`schemas/user/`)

- [x] **User Authentication Schemas**:
  - [x] Clerk user ID validation
  - [x] JWT payload schema
- [x] **API Key Schemas**:
  - [x] API key creation schema
  - [x] API key validation schema
- [x] **Credit Wallet Schemas**:
  - [x] Wallet balance schema
  - [x] Transaction history schema
- [x] Export all schemas from `schemas/user/index.ts`

### Schema Exports

- [x] Create `schemas/index.ts` that exports all schemas
- [x] Export inferred types using `z.infer`
- [x] Document schema usage

---

## 2.2 Result Utilities (`packages/core/result`)

### Safe Fetch (`result/safe-fetch.ts`)

- [x] **Implement `safeFetch`**:
  - [x] Discriminated error unions:
    - `NetworkError` - Network failures
    - `HttpError<E>` - HTTP error responses (4xx, 5xx)
    - `ParseError` - JSON parsing failures
  - [x] Return `ResultAsync<T, FetchError<E>>`
  - [x] Handle fetch promise with `ResultAsync.fromPromise`
  - [x] Chain HTTP status checking with `.andThen()`
  - [x] Parse JSON with error handling

### Safe Zod (`result/safe-zod.ts`)

- [x] **Implement `safeZodParse`**:
  - [x] Generic function accepting Zod schema
  - [x] Return `Result<T, ZodParseError<T>>`
  - [x] Integrate with Zod's `safeParse`
  - [x] Wrap errors in discriminated union format
- [x] **ZodParseError Type**:
  ```typescript
  interface ZodParseError<T> {
    type: "zod";
    errors: z.ZodError<T>;
  }
  ```

### Safe Database (`result/safe-db.ts`)

- [x] **Database Operation Wrappers**:
  - [x] Wrap Drizzle queries in Result types
  - [x] Handle database errors explicitly
- [x] **Transaction Helpers**:
  - [x] Transaction wrapper with Result return
  - [x] Rollback on error
- [x] **Query Error Handling**:
  - [x] Database connection errors
  - [x] Query execution errors
  - [x] Constraint violation errors

### Result Exports

- [x] Export all utilities from `result/index.ts`
- [x] Export error type definitions
- [x] Document usage examples

---

## 2.3 Audit Logging (`packages/core/audit`)

### Audit Schemas (`audit/schemas.ts`)

- [x] **Audit Log Entry Schema** (Zod):
  - [x] Log ID (UUID)
  - [x] Scan job ID (UUID, foreign key)
  - [x] URL accessed (string, indexed)
  - [x] Timestamp (ISO 8601)
  - [x] Content hash (SHA-256)
  - [x] HTTP status (number)
  - [x] HTTP headers (object, sanitized)
  - [x] Content type (MIME string)
  - [x] Risk assessment summary (object)
  - [x] **Explicitly exclude**: content body, screenshots, DOM content
- [x] **Content Hash Validation**:
  - [x] SHA-256 format validation
  - [x] Length validation
- [x] **Metadata-Only Validation**:
  - [x] Ensure no content fields exist
  - [x] Runtime validation helper

### Audit Logger (`audit/logger.ts`)

- [x] **Append-Only Log Writer**:
  - [x] Interface for audit log storage
  - [x] Immutable write operations
  - [x] Atomic write guarantees
- [x] **Content Hash Generation Utility**:
  - [x] SHA-256 hash function
  - [x] Stream-based hashing for large content
  - [x] Return Result type
- [x] **Secure Storage Integration Interface**:
  - [x] Abstract storage interface
  - [x] Implementation for Turso/libSQL
  - [x] Future support for other backends
- [x] **Result-Based Error Handling**:
  - [x] All operations return Result types
  - [x] Explicit error types for audit failures

### Audit Exports

- [x] Export all utilities from `audit/index.ts`
- [x] Export schema and types
- [x] Document audit log format

---

## 2.4 Shared Types & Utilities

### Types (`types/`)

- [x] **Extract Types from Zod Schemas**:
  - [x] Use `z.infer` for all schemas
  - [x] Export as TypeScript types
- [x] **Result Type Helpers**:
  - [x] Extract success/error types from Result
  - [x] Type utilities for Result composition
- [x] **Common Domain Types**:
  - [x] ScanJobState type
  - [x] RiskCategory type
  - [x] User types

### Utils (`utils/`)

- [x] **Content Hash Utilities**:
  - [x] SHA-256 hashing function
  - [x] Stream hashing for large content
- [x] **URL Validation Helpers**:
  - [x] SSRF-safe URL validation
  - [x] URL normalization
  - [x] Domain extraction
- [x] **Error Formatters**:
  - [x] Format Zod errors for API responses
  - [x] Format Result errors
  - [x] User-friendly error messages

### Config (`config/`)

- [x] **Environment Variable Schemas** (Zod):
  - [x] Database configuration schema
  - [x] Redis configuration schema
  - [x] Clerk configuration schema
  - [x] LLM provider configuration schemas
- [x] **Configuration Defaults**:
  - [x] Development defaults
  - [x] Production defaults
- [x] **Validation Helpers**:
  - [x] Validate and load environment variables
  - [x] Return Result types
  - [x] Provide helpful error messages

---

## 2.5 Public API Exports

- [x] Create `index.ts` that exports:
  - [x] All schemas and types
  - [x] Result utilities
  - [x] Audit utilities
  - [x] Shared types and utils
  - [x] Configuration helpers
- [x] Document public API
- [x] Version the package

---

## Success Criteria

- [x] All Zod schemas are defined and tested
- [x] Result utilities work correctly with examples
- [x] Audit logging schemas prevent content storage
- [x] Types are properly inferred from schemas
- [x] Package can be imported and used by other packages
- [x] All exports are documented

---

## Notes

- Follow the neverthrow patterns from the architecture doc
- Ensure all schemas are strict and validate thoroughly
- Audit schemas must explicitly exclude content fields
- Use discriminated unions for error types
- Keep utilities pure and testable
