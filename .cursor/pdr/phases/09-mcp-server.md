# Phase 9: MCP Server

**Status:** Not Started  
**Dependencies:** Phase 1, Phase 5  
**Estimated Time:** 2-3 days

## Overview

Implement an MCP (Model Context Protocol) server that exposes SafeURL scanning capabilities as tools for AI agents and development tools.

---

## 9.1 MCP Server Setup (`apps/mcp-server`)

- [ ] Create MCP server entry point
- [ ] Install dependencies:
  - `@modelcontextprotocol/sdk`
  - `@safeurl/core` (workspace)
- [ ] Configure MCP server
- [ ] Set up server initialization

### Project Structure

```
apps/mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Entry point
│   ├── tools/
│   │   ├── scan-url.ts
│   │   ├── get-status.ts
│   │   └── get-report.ts
│   └── lib/
│       └── api-client.ts
└── .env.example
```

---

## 9.2 MCP Tools

### scan_url Tool

- [ ] **Input Schema**:
  ```typescript
  {
    url: string; // URL to scan
  }
  ```
- [ ] **Implementation**:
  - [ ] Call API POST /v1/scans
  - [ ] Pass URL in request body
  - [ ] Handle authentication (API key)
  - [ ] Return job ID
- [ ] **Output**:
  ```typescript
  {
    jobId: string;
    status: "queued";
    message: string;
  }
  ```
- [ ] **Error Handling**:
  - [ ] Handle API errors
  - [ ] Return user-friendly error messages
  - [ ] Use Result types internally

### get_scan_status Tool

- [ ] **Input Schema**:
  ```typescript
  {
    jobId: string; // Scan job ID
  }
  ```
- [ ] **Implementation**:
  - [ ] Call API GET /v1/scans/:id
  - [ ] Pass job ID as path parameter
  - [ ] Handle authentication
  - [ ] Return scan status/result
- [ ] **Output**:
  ```typescript
  {
    jobId: string;
    status: "queued" | "fetching" | "analyzing" | "completed" | "failed";
    result?: ScanResult; // If completed
  }
  ```
- [ ] **Error Handling**:
  - [ ] Handle not found errors
  - [ ] Handle unauthorized errors
  - [ ] Return appropriate error messages

### get_url_report Tool

- [ ] **Input Schema**:
  ```typescript
  {
    jobId: string; // Scan job ID
  }
  ```
- [ ] **Implementation**:
  - [ ] Call API GET /v1/scans/:id
  - [ ] Format response as report
  - [ ] Include risk assessment details
  - [ ] Include categories and indicators
- [ ] **Output**:
  ```typescript
  {
    jobId: string;
    url: string;
    riskScore: number;
    categories: string[];
    reasoning: string;
    indicators: string[];
    timestamp: string;
  }
  ```
- [ ] **Error Handling**:
  - [ ] Handle incomplete scans
  - [ ] Format errors appropriately
  - [ ] Return helpful messages

---

## 9.3 Error Handling

### API Error Conversion

- [ ] **Convert API Errors to MCP Format**:
  - [ ] Map HTTP status codes to MCP errors
  - [ ] Extract error messages from API responses
  - [ ] Format errors consistently
- [ ] **Use Result Types Internally**:
  - [ ] Wrap API calls in Result types
  - [ ] Handle errors explicitly
  - [ ] Convert Result errors to MCP errors
- [ ] **Provide Helpful Error Messages**:
  - [ ] User-friendly error descriptions
  - [ ] Include error codes
  - [ ] Suggest solutions when possible

### Error Types

- [ ] **Authentication Errors**:
  - [ ] Invalid API key
  - [ ] Missing authentication
- [ ] **Validation Errors**:
  - [ ] Invalid URL format
  - [ ] Invalid job ID
- [ ] **API Errors**:
  - [ ] Service unavailable
  - [ ] Rate limiting
  - [ ] Internal server errors

---

## Success Criteria

- [ ] MCP server starts correctly
- [ ] All tools are registered
- [ ] Tools call API correctly
- [ ] Error handling works
- [ ] Output formats are correct
- [ ] Authentication works
- [ ] Server can be used by MCP clients

---

## Notes

- Follow MCP SDK patterns
- Keep tool descriptions clear for AI agents
- Use Result types for internal error handling
- Test with MCP clients (Claude, Cursor, etc.)
- Document tool usage
- Handle rate limiting gracefully

