# Phase 4: Mastra Integration

**Status:** Complete  
**Dependencies:** Phase 1, Phase 2  
**Estimated Time:** 3-4 days

## Overview

Set up Mastra framework, create the URL safety agent, and implement tools for content extraction, screenshot analysis, and reputation checking.

---

## 4.1 Mastra Package Setup (`packages/mastra`)

- [x] Create `@safeurl/mastra` package
- [x] Install Mastra dependencies:
  - `@mastra/core` - Core Mastra framework
  - `@ai-sdk/openai` - OpenAI provider (or use Mastra model router)
  - Additional providers as needed (Anthropic, Google, etc.)
- [x] Set up Mastra instance configuration
- [x] Configure environment variables for API keys

### Package Structure

```
packages/mastra/
├── package.json
├── tsconfig.json
├── agents/
│   └── url-safety-agent.ts
├── tools/
│   ├── content-extraction.ts
│   ├── screenshot-analysis.ts
│   └── reputation-check.ts
└── index.ts
```

---

## 4.2 URL Safety Agent (`packages/mastra/agents`)

### URL Safety Agent (`agents/url-safety-agent.ts`)

- [x] **Create Agent**:
  - [x] Agent name: "url-safety-agent"
  - [x] Specialized instructions for threat detection:
    - Phishing attempts
    - Malware distribution
    - Scam patterns
    - Suspicious redirects
    - Content safety
- [x] **Configure Model**:
  - [x] Start with OpenAI GPT-4o (or Mastra model router)
  - [x] Support for switching models via config
- [x] **Structured Output Schema**:
  ```typescript
  z.object({
    riskScore: z.number().min(0).max(100),
    categories: z.array(
      z.enum(["phishing", "malware", "scam", "suspicious", "safe"])
    ),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    indicators: z.array(z.string()),
  });
  ```
- [x] **Configure maxSteps**:
  - [x] Set appropriate limit for multi-step analysis
  - [x] Allow agent to use tools iteratively

---

## 4.3 Mastra Tools (`packages/mastra/tools`)

### Content Extraction Tool (`tools/content-extraction.ts`)

- [x] **Input Schema**:
  ```typescript
  z.object({
    url: z.string().url(),
    options: z
      .object({
        timeout: z.number().optional(),
        followRedirects: z.boolean().optional(),
      })
      .optional(),
  });
  ```
- [x] **Output Schema**:
  ```typescript
  z.object({
    metadata: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      contentHash: z.string(),
      contentType: z.string(),
      httpStatus: z.number(),
      headers: z.record(z.string()),
    }),
    // Explicitly NO content body
  });
  ```
- [x] **Execute Function**:
  - [x] SSRF-safe URL validation
  - [x] Use `safeFetch` from `@safeurl/core`
  - [x] Extract metadata only (no content storage)
  - [x] Generate content hash
  - [x] Return Result type
  - [x] Handle errors explicitly

### Screenshot Analysis Tool (`tools/screenshot-analysis.ts`)

- [x] **Input Schema**:
  ```typescript
  z.object({
    url: z.string().url(),
    viewport: z
      .object({
        width: z.number().default(1920),
        height: z.number().default(1080),
      })
      .optional(),
  });
  ```
- [x] **Output Schema**:
  ```typescript
  z.object({
    screenshotHash: z.string(), // Hash of screenshot, not screenshot itself
    visualAnalysis: z.object({
      suspiciousElements: z.array(z.string()),
      layoutAnalysis: z.string(),
    }),
    metadata: z.object({
      viewport: z.object({
        width: z.number(),
        height: z.number(),
      }),
    }),
  });
  ```
- [x] **Execute Function**:
  - [x] Puppeteer/Playwright setup
  - [x] Navigate to URL with SSRF protection
  - [x] Capture screenshot (temporary, in-memory only)
  - [x] Generate screenshot hash
  - [x] Perform visual analysis (metadata only)
  - [x] **Do NOT store screenshot**
  - [x] Return Result type

### Reputation Check Tool (`tools/reputation-check.ts`)

- [x] **Input Schema**:
  ```typescript
  z.object({
    domain: z.string(),
    url: z.string().url().optional(),
  });
  ```
- [x] **Output Schema**:
  ```typescript
  z.object({
    reputationScore: z.number().min(0).max(100),
    threatIntel: z
      .object({
        isMalicious: z.boolean(),
        categories: z.array(z.string()),
        sources: z.array(z.string()),
      })
      .optional(),
    domainAge: z.number().optional(),
    sslInfo: z
      .object({
        isValid: z.boolean(),
        issuer: z.string().optional(),
      })
      .optional(),
  });
  ```
- [x] **Execute Function**:
  - [x] Domain extraction and validation
  - [x] Check threat intelligence APIs (optional integration)
  - [x] SSL certificate validation
  - [x] Domain age lookup (optional)
  - [x] Return Result type
  - [x] Handle API failures gracefully

---

## 4.4 Mastra Configuration

### Mastra Instance (`index.ts`)

- [x] **Create Mastra Instance**:

  ```typescript
  import { Mastra } from "@mastra/core/mastra";
  import { urlSafetyAgent } from "./agents/url-safety-agent";

  export const mastra = new Mastra({
    agents: { urlSafetyAgent },
  });
  ```

- [x] **Configure Agent with Tools**:
  - [x] Register all tools with agent
  - [x] Set up tool descriptions for agent routing
- [x] **Environment Variables**:
  - [x] LLM provider API keys
  - [x] Model selection
  - [x] Tool configuration
- [x] **Export Public API**:
  - [x] Export Mastra instance
  - [x] Export agent getter
  - [x] Export tool getters

### Testing

- [x] Test agent locally:
  - [x] Simple URL analysis
  - [x] Tool calling functionality
  - [x] Structured output validation
  - [x] Error handling
- [x] Verify no content is stored
- [x] Test with various URL types

---

## Success Criteria

- [x] Mastra package is set up correctly
- [x] URL safety agent can analyze URLs
- [x] All tools work correctly and return Result types
- [x] Structured output matches schema
- [x] No content is stored (only metadata/hashes)
- [x] Agent can use tools in multi-step analysis
- [x] Error handling is explicit and type-safe

---

## Notes

- Follow Mastra best practices for agent configuration
- Ensure all tools use Result types from neverthrow
- Tools must never store content, only metadata
- Keep tool descriptions clear for agent routing
- Test with various threat scenarios
- Consider adding more tools as needed (DNS lookup, etc.)
