# Phase 4: Mastra Integration

**Status:** Not Started  
**Dependencies:** Phase 1, Phase 2  
**Estimated Time:** 3-4 days

## Overview

Set up Mastra framework, create the URL safety agent, and implement tools for content extraction, screenshot analysis, and reputation checking.

---

## 4.1 Mastra Package Setup (`packages/mastra`)

- [ ] Create `@safeurl/mastra` package
- [ ] Install Mastra dependencies:
  - `@mastra/core` - Core Mastra framework
  - `@ai-sdk/openai` - OpenAI provider (or use Mastra model router)
  - Additional providers as needed (Anthropic, Google, etc.)
- [ ] Set up Mastra instance configuration
- [ ] Configure environment variables for API keys

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

- [ ] **Create Agent**:
  - [ ] Agent name: "url-safety-agent"
  - [ ] Specialized instructions for threat detection:
    - Phishing attempts
    - Malware distribution
    - Scam patterns
    - Suspicious redirects
    - Content safety
- [ ] **Configure Model**:
  - [ ] Start with OpenAI GPT-4o (or Mastra model router)
  - [ ] Support for switching models via config
- [ ] **Structured Output Schema**:
  ```typescript
  z.object({
    riskScore: z.number().min(0).max(100),
    categories: z.array(
      z.enum(["phishing", "malware", "scam", "suspicious", "safe"])
    ),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    indicators: z.array(z.string()),
  })
  ```
- [ ] **Configure maxSteps**:
  - [ ] Set appropriate limit for multi-step analysis
  - [ ] Allow agent to use tools iteratively

---

## 4.3 Mastra Tools (`packages/mastra/tools`)

### Content Extraction Tool (`tools/content-extraction.ts`)

- [ ] **Input Schema**:
  ```typescript
  z.object({
    url: z.string().url(),
    options: z.object({
      timeout: z.number().optional(),
      followRedirects: z.boolean().optional(),
    }).optional(),
  })
  ```
- [ ] **Output Schema**:
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
  })
  ```
- [ ] **Execute Function**:
  - [ ] SSRF-safe URL validation
  - [ ] Use `safeFetch` from `@safeurl/core`
  - [ ] Extract metadata only (no content storage)
  - [ ] Generate content hash
  - [ ] Return Result type
  - [ ] Handle errors explicitly

### Screenshot Analysis Tool (`tools/screenshot-analysis.ts`)

- [ ] **Input Schema**:
  ```typescript
  z.object({
    url: z.string().url(),
    viewport: z.object({
      width: z.number().default(1920),
      height: z.number().default(1080),
    }).optional(),
  })
  ```
- [ ] **Output Schema**:
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
  })
  ```
- [ ] **Execute Function**:
  - [ ] Puppeteer/Playwright setup
  - [ ] Navigate to URL with SSRF protection
  - [ ] Capture screenshot (temporary, in-memory only)
  - [ ] Generate screenshot hash
  - [ ] Perform visual analysis (metadata only)
  - [ ] **Do NOT store screenshot**
  - [ ] Return Result type

### Reputation Check Tool (`tools/reputation-check.ts`)

- [ ] **Input Schema**:
  ```typescript
  z.object({
    domain: z.string(),
    url: z.string().url().optional(),
  })
  ```
- [ ] **Output Schema**:
  ```typescript
  z.object({
    reputationScore: z.number().min(0).max(100),
    threatIntel: z.object({
      isMalicious: z.boolean(),
      categories: z.array(z.string()),
      sources: z.array(z.string()),
    }).optional(),
    domainAge: z.number().optional(),
    sslInfo: z.object({
      isValid: z.boolean(),
      issuer: z.string().optional(),
    }).optional(),
  })
  ```
- [ ] **Execute Function**:
  - [ ] Domain extraction and validation
  - [ ] Check threat intelligence APIs (optional integration)
  - [ ] SSL certificate validation
  - [ ] Domain age lookup (optional)
  - [ ] Return Result type
  - [ ] Handle API failures gracefully

---

## 4.4 Mastra Configuration

### Mastra Instance (`index.ts`)

- [ ] **Create Mastra Instance**:
  ```typescript
  import { Mastra } from "@mastra/core/mastra";
  import { urlSafetyAgent } from "./agents/url-safety-agent";

  export const mastra = new Mastra({
    agents: { urlSafetyAgent },
  });
  ```
- [ ] **Configure Agent with Tools**:
  - [ ] Register all tools with agent
  - [ ] Set up tool descriptions for agent routing
- [ ] **Environment Variables**:
  - [ ] LLM provider API keys
  - [ ] Model selection
  - [ ] Tool configuration
- [ ] **Export Public API**:
  - [ ] Export Mastra instance
  - [ ] Export agent getter
  - [ ] Export tool getters

### Testing

- [ ] Test agent locally:
  - [ ] Simple URL analysis
  - [ ] Tool calling functionality
  - [ ] Structured output validation
  - [ ] Error handling
- [ ] Verify no content is stored
- [ ] Test with various URL types

---

## Success Criteria

- [ ] Mastra package is set up correctly
- [ ] URL safety agent can analyze URLs
- [ ] All tools work correctly and return Result types
- [ ] Structured output matches schema
- [ ] No content is stored (only metadata/hashes)
- [ ] Agent can use tools in multi-step analysis
- [ ] Error handling is explicit and type-safe

---

## Notes

- Follow Mastra best practices for agent configuration
- Ensure all tools use Result types from neverthrow
- Tools must never store content, only metadata
- Keep tool descriptions clear for agent routing
- Test with various threat scenarios
- Consider adding more tools as needed (DNS lookup, etc.)

