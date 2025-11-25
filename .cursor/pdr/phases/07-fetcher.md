# Phase 7: Fetcher Container

**Status:** Not Started  
**Dependencies:** Phase 1, Phase 2, Phase 4  
**Estimated Time:** 4-5 days

## Overview

Implement the ephemeral fetcher container that safely fetches URLs, performs analysis using Mastra agents, and returns results without persisting any content.

---

## 7.1 Fetcher Package Setup (`apps/fetcher`)

- [ ] Create fetcher entry point
- [ ] Install dependencies:
  - `@safeurl/core` (workspace)
  - `@safeurl/mastra` (workspace)
  - `puppeteer` or `playwright` (optional)
- [ ] Set up environment variable parsing
- [ ] Configure timeouts and limits

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

- [ ] Parse command-line arguments or environment variables:
  - [ ] Job ID
  - [ ] URL to scan
- [ ] Set up error handling
- [ ] Configure timeouts
- [ ] Initialize Mastra agent

---

## 7.2 URL Fetching (`apps/fetcher/fetch`)

### Safe URL Fetch

- [ ] **SSRF-Safe URL Validation**:
  - [ ] Validate URL format
  - [ ] Check for private IP addresses
  - [ ] Check for localhost/local network
  - [ ] Reject dangerous protocols
  - [ ] Use validation from `@safeurl/core`
- [ ] **Strict Timeout Enforcement**:
  - [ ] Set fetch timeout (e.g., 30 seconds)
  - [ ] Abort fetch on timeout
  - [ ] Return timeout error
- [ ] **Network Error Handling**:
  - [ ] Use `safeFetch` from `@safeurl/core`
  - [ ] Handle network errors with Result types
  - [ ] Handle DNS errors
  - [ ] Handle connection timeouts
- [ ] **HTTP Status Validation**:
  - [ ] Check HTTP status code
  - [ ] Handle redirects (limit redirect depth)
  - [ ] Handle error status codes
- [ ] **Content Type Detection**:
  - [ ] Extract Content-Type header
  - [ ] Validate MIME type
  - [ ] Reject unsupported types if needed

### Content Extraction

- [ ] **HTML Parsing (Metadata Only)**:
  - [ ] Parse HTML to extract metadata:
    - Title
    - Meta description
    - Meta tags
    - Link structure
  - [ ] **Do NOT store HTML content**
- [ ] **Content Hash Generation**:
  - [ ] Generate SHA-256 hash of content
  - [ ] Use streaming hash for large content
  - [ ] Store hash only, not content
- [ ] **Header Extraction**:
  - [ ] Extract HTTP headers
  - [ ] Sanitize headers (remove sensitive data)
  - [ ] Store header metadata
- [ ] **No Content Body Storage**:
  - [ ] Verify no content is stored
  - [ ] Only store hash and metadata
  - [ ] Clear content from memory after hashing

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

- [ ] **Initialize Mastra Agent**:
  - [ ] Get agent from `@safeurl/mastra`
  - [ ] Configure agent with fetched metadata
  - [ ] Pass content hash and metadata (NOT content)
- [ ] **Call Agent with Structured Output**:
  - [ ] Use structured output schema
  - [ ] Pass metadata to agent:
    - URL
    - Content hash
    - HTTP status
    - Headers (sanitized)
    - Content type
    - Extracted metadata
  - [ ] **Explicitly exclude content body**
- [ ] **Handle Agent Errors**:
  - [ ] Use Result types for error handling
  - [ ] Handle LLM API errors
  - [ ] Handle timeout errors
  - [ ] Handle parsing errors

### Result Processing

- [ ] **Validate Agent Output**:
  - [ ] Validate with Zod schema
  - [ ] Ensure all required fields present
  - [ ] Verify risk score range
  - [ ] Verify categories are valid
- [ ] **Extract Analysis Results**:
  - [ ] Extract risk score
  - [ ] Extract categories
  - [ ] Extract confidence
  - [ ] Extract reasoning
  - [ ] Extract indicators
- [ ] **Prepare Result Payload**:
  - [ ] Format according to schema
  - [ ] Include all metadata
  - [ ] Exclude any content
  - [ ] Return Result type

---

## 7.5 Audit Logging (`apps/fetcher/audit`)

### Log Creation

- [ ] **Create Audit Log Entry** (Metadata Only):
  - [ ] Include URL accessed
  - [ ] Include timestamp
  - [ ] Include content hash
  - [ ] Include HTTP status, headers, content type
  - [ ] Include risk assessment summary
  - [ ] **Explicitly exclude content body**
- [ ] **Validate Log Entry**:
  - [ ] Use audit schema from `@safeurl/core`
  - [ ] Ensure no content fields
  - [ ] Verify all required fields present

### Log Writing

- [ ] **Write to Append-Only Audit Storage**:
  - [ ] Use audit logger from `@safeurl/core`
  - [ ] Write to database (via callback or stdout)
  - [ ] Ensure append-only semantics
- [ ] **Use Result Types**:
  - [ ] Wrap write operation in Result
  - [ ] Handle write errors
  - [ ] Return appropriate error types
- [ ] **Ensure Atomic Write Operations**:
  - [ ] Use transactions if writing to database
  - [ ] Ensure write succeeds or fails atomically
  - [ ] Don't partially write logs

---

## 7.6 Output & Cleanup

### Output Formatting

- [ ] **Format Result as JSON**:
  - [ ] Structure according to schema
  - [ ] Include scan results
  - [ ] Include audit log data
  - [ ] Exclude all content
- [ ] **Write to stdout**:
  - [ ] Output JSON to stdout
  - [ ] Ensure valid JSON format
  - [ ] Handle output errors

### Exit & Cleanup

- [ ] **Exit with Appropriate Code**:
  - [ ] Exit 0 on success
  - [ ] Exit 1 on error
  - [ ] Exit 2 on timeout
- [ ] **Container Cleanup**:
  - [ ] Cleanup is automatic with `--rm` flag
  - [ ] Ensure no files are written to disk
  - [ ] Clear all memory containing content
  - [ ] Log cleanup completion

---

## Success Criteria

- [ ] Fetcher safely fetches URLs
- [ ] SSRF protection works correctly
- [ ] Content is never persisted
- [ ] Content hash is generated correctly
- [ ] Mastra agent analysis works
- [ ] Audit logs are created correctly
- [ ] Results are formatted correctly
- [ ] Container exits cleanly
- [ ] All operations use Result types
- [ ] No content leaks to disk or logs

---

## Notes

- Container must be completely stateless
- All content must be cleared from memory after processing
- Verify no content is written to stdout (only JSON results)
- Test with various URL types (HTTP, HTTPS, redirects)
- Test SSRF protection thoroughly
- Ensure timeouts are enforced
- Keep container image minimal for fast startup

