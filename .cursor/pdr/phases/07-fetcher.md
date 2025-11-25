# Phase 7: Fetcher Container

**Status:** Core Implementation Complete (Optional screenshot/DOM analysis not implemented)  
**Dependencies:** Phase 1, Phase 2, Phase 4  
**Estimated Time:** 4-5 days

## Overview

Implement the ephemeral fetcher container that safely fetches URLs, performs analysis using Mastra agents, and returns results without persisting any content.

---

## 7.1 Fetcher Package Setup (`apps/fetcher`)

- [x] Create fetcher entry point
- [x] Install dependencies:
  - `@safeurl/core` (workspace)
  - `@safeurl/mastra` (workspace)
  - `puppeteer` or `playwright` (optional)
- [x] Set up environment variable parsing
- [x] Configure timeouts and limits

### Fetcher Structure

```
apps/fetcher/
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── index.ts           # Entry point
│   ├── fetch/
│   │   └── url-fetcher.ts
│   ├── analysis/
│   │   └── agent.ts
│   ├── audit/
│   │   └── logger.ts
│   └── lib/
│       ├── hash.ts
│       └── validation.ts
└── .env.example
```

### Entry Point

- [x] Parse command-line arguments or environment variables:
  - [x] Job ID
  - [x] URL to scan
- [x] Set up error handling
- [x] Configure timeouts
- [x] Initialize Mastra agent

---

## 7.2 URL Fetching (`apps/fetcher/fetch`)

### Safe URL Fetch

- [x] **SSRF-Safe URL Validation**:
  - [x] Validate URL format
  - [x] Check for private IP addresses
  - [x] Check for localhost/local network
  - [x] Reject dangerous protocols
  - [x] Use validation from `@safeurl/core`
- [x] **Strict Timeout Enforcement**:
  - [x] Set fetch timeout (e.g., 30 seconds)
  - [x] Abort fetch on timeout
  - [x] Return timeout error
- [x] **Network Error Handling**:
  - [x] Use `safeFetch` from `@safeurl/core`
  - [x] Handle network errors with Result types
  - [x] Handle DNS errors
  - [x] Handle connection timeouts
- [x] **HTTP Status Validation**:
  - [x] Check HTTP status code
  - [x] Handle redirects (limit redirect depth)
  - [x] Handle error status codes
- [x] **Content Type Detection**:
  - [x] Extract Content-Type header
  - [x] Validate MIME type
  - [x] Reject unsupported types if needed

### Content Extraction

- [x] **HTML Parsing (Metadata Only)**:
  - [x] Parse HTML to extract metadata:
    - Title
    - Meta description
    - Meta tags
    - Link structure
  - [x] **Do NOT store HTML content**
- [x] **Content Hash Generation**:
  - [x] Generate SHA-256 hash of content
  - [x] Use streaming hash for large content
  - [x] Store hash only, not content
- [x] **Header Extraction**:
  - [x] Extract HTTP headers
  - [x] Sanitize headers (remove sensitive data)
  - [x] Store header metadata
- [x] **No Content Body Storage**:
  - [x] Verify no content is stored
  - [x] Only store hash and metadata
  - [x] Clear content from memory after hashing

---

## 7.3 Screenshot & DOM Analysis (Optional)

### Screenshot Capture

- [ ] **Puppeteer/Playwright Setup**:
  - [ ] Initialize browser instance
  - [ ] Configure headless mode
  - [ ] Set up viewport
- [ ] **Viewport Configuration**:
  - [ ] Default viewport size
  - [ ] Configurable via options
- [ ] **Screenshot to Base64** (Temporary):
  - [ ] Capture screenshot
  - [ ] Convert to base64 (in-memory only)
  - [ ] Generate screenshot hash
  - [ ] **Do NOT persist screenshot**
  - [ ] Clear from memory after hashing
- [ ] **Visual Analysis Metadata Extraction**:
  - [ ] Analyze screenshot for suspicious elements
  - [ ] Extract visual patterns (metadata only)
  - [ ] Generate analysis summary
  - [ ] Store analysis, not screenshot

### DOM Parsing

- [ ] **Extract Structural Metadata**:
  - [ ] Parse DOM structure
  - [ ] Extract element counts
  - [ ] Extract script sources (URLs only)
  - [ ] Extract form structure (metadata)
- [ ] **Identify Suspicious Patterns**:
  - [ ] Detect suspicious script patterns
  - [ ] Detect suspicious form patterns
  - [ ] Detect obfuscation attempts
  - [ ] Return pattern metadata
- [ ] **No DOM Content Storage**:
  - [ ] Verify no DOM content is stored
  - [ ] Only store structural metadata
  - [ ] Clear DOM from memory after analysis

---

## 7.4 Mastra Agent Analysis (`apps/fetcher/analysis`)

### Agent Invocation

- [x] **Initialize Mastra Agent**:
  - [x] Get agent from `@safeurl/mastra`
  - [x] Configure agent with fetched metadata
  - [x] Pass content hash and metadata (NOT content)
- [x] **Call Agent with Structured Output**:
  - [x] Use structured output schema
  - [x] Pass metadata to agent:
    - URL
    - Content hash
    - HTTP status
    - Headers (sanitized)
    - Content type
    - Extracted metadata
  - [x] **Explicitly exclude content body**
- [x] **Handle Agent Errors**:
  - [x] Use Result types for error handling
  - [x] Handle LLM API errors
  - [x] Handle timeout errors
  - [x] Handle parsing errors

### Result Processing

- [x] **Validate Agent Output**:
  - [x] Validate with Zod schema
  - [x] Ensure all required fields present
  - [x] Verify risk score range
  - [x] Verify categories are valid
- [x] **Extract Analysis Results**:
  - [x] Extract risk score
  - [x] Extract categories
  - [x] Extract confidence
  - [x] Extract reasoning
  - [x] Extract indicators
- [x] **Prepare Result Payload**:
  - [x] Format according to schema
  - [x] Include all metadata
  - [x] Exclude any content
  - [x] Return Result type

---

## 7.5 Audit Logging (`apps/fetcher/audit`)

### Log Creation

- [x] **Create Audit Log Entry** (Metadata Only):
  - [x] Include URL accessed
  - [x] Include timestamp
  - [x] Include content hash
  - [x] Include HTTP status, headers, content type
  - [x] Include risk assessment summary
  - [x] **Explicitly exclude content body**
- [x] **Validate Log Entry**:
  - [x] Use audit schema from `@safeurl/core`
  - [x] Ensure no content fields
  - [x] Verify all required fields present

### Log Writing

- [x] **Write to Append-Only Audit Storage**:
  - [x] Use audit logger from `@safeurl/core`
  - [x] Write to database (via callback or stdout)
  - [x] Ensure append-only semantics
- [x] **Use Result Types**:
  - [x] Wrap write operation in Result
  - [x] Handle write errors
  - [x] Return appropriate error types
- [x] **Ensure Atomic Write Operations**:
  - [x] Use transactions if writing to database
  - [x] Ensure write succeeds or fails atomically
  - [x] Don't partially write logs

---

## 7.6 Output & Cleanup

### Output Formatting

- [x] **Format Result as JSON**:
  - [x] Structure according to schema
  - [x] Include scan results
  - [x] Include audit log data
  - [x] Exclude all content
- [x] **Write to stdout**:
  - [x] Output JSON to stdout
  - [x] Ensure valid JSON format
  - [x] Handle output errors

### Exit & Cleanup

- [x] **Exit with Appropriate Code**:
  - [x] Exit 0 on success
  - [x] Exit 1 on error
  - [x] Exit 2 on timeout
- [x] **Container Cleanup**:
  - [x] Cleanup is automatic with `--rm` flag
  - [x] Ensure no files are written to disk
  - [x] Clear all memory containing content
  - [x] Log cleanup completion

---

## Success Criteria

- [x] Fetcher safely fetches URLs
- [x] SSRF protection works correctly
- [x] Content is never persisted
- [x] Content hash is generated correctly
- [x] Mastra agent analysis works
- [x] Audit logs are created correctly
- [x] Results are formatted correctly
- [x] Container exits cleanly
- [x] All operations use Result types
- [x] No content leaks to disk or logs

---

## Notes

- Container must be completely stateless
- All content must be cleared from memory after processing
- Verify no content is written to stdout (only JSON results)
- Test with various URL types (HTTP, HTTPS, redirects)
- Test SSRF protection thoroughly
- Ensure timeouts are enforced
- Keep container image minimal for fast startup
