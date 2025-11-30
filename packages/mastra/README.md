# @safeurl/mastra

Mastra-based AI agent and tools for URL safety analysis. Provides agentic capabilities for detecting phishing, malware, scams, and suspicious content.

## Features

- **URL Safety Agent**: Specialized Mastra agent for threat detection
- **Multi-Tool Analysis**: Content extraction, screenshot analysis, and reputation checking
- **Structured Output**: Zod-validated risk scores and threat categories
- **Privacy-First**: Only stores metadata and hashes, never actual content
- **SSRF Protection**: Built-in SSRF-safe URL validation

## Installation

```bash
# In monorepo root
bun install
```

## Usage

### Agent

```typescript
import { urlSafetyAgent } from "@safeurl/mastra";

// Analyze a URL
const result = await urlSafetyAgent.generate({
  messages: [
    {
      role: "user",
      content: "Analyze this URL for safety: https://example.com",
    },
  ],
});

// Result includes structured output:
// {
//   riskScore: 0-100,
//   categories: ["phishing" | "malware" | "scam" | "suspicious" | "safe"],
//   confidence: 0.0-1.0,
//   reasoning: string,
//   indicators: string[]
// }
```

### Tools

```typescript
import {
  contentExtractionTool,
  reputationCheckTool,
  screenshotAnalysisTool,
} from "@safeurl/mastra";

// Extract content metadata
const content = await contentExtractionTool.execute({
  context: { url: "https://example.com" },
});

// Analyze screenshot
const screenshot = await screenshotAnalysisTool.execute({
  context: { url: "https://example.com" },
});

// Check domain reputation
const reputation = await reputationCheckTool.execute({
  context: { domain: "example.com" },
});
```

### Mastra Instance

```typescript
import { mastra } from "@safeurl/mastra";

// Use the configured Mastra instance
const result = await mastra.agents.urlSafetyAgent.generate({ ... });
```

## Agent Configuration

The URL Safety Agent uses:

- **Model**: `openrouter/qwen/qwen-2.5-vl-72b-instruct` (Qwen2.5-VL-72B-Instruct)
- **Max Steps**: 10 (allows iterative tool usage)
- **Structured Output**: Zod schema for consistent risk assessment

## Tools

### Content Extraction Tool

Extracts metadata from URLs without storing content:

- Title and description (from HTML)
- Content hash (SHA-256)
- HTTP status and headers
- Content type

**Features**:

- SSRF-safe URL validation
- Privacy-first (only metadata, no content storage)
- Type-safe with neverthrow error handling

### Screenshot Analysis Tool

Takes screenshots and performs visual analysis:

- Screenshot hash (not the image itself)
- Suspicious element detection
- Layout analysis
- Form and link detection

**Features**:

- Uses Playwright for browser automation
- Ephemeral browser instances
- Visual pattern detection
- Privacy-first (screenshots only in memory temporarily)

### Reputation Check Tool

Checks domain reputation using heuristics:

- Reputation score (0-100)
- SSL certificate validation
- Suspicious pattern detection
- Threat intelligence (basic)

**Features**:

- Heuristic-based analysis
- SSL validation
- Domain pattern detection
- Extensible for threat intel APIs

## Project Structure

```
src/
├── agents/
│   ├── index.ts
│   └── url-safety-agent.ts    # Main agent configuration
├── tools/
│   ├── index.ts
│   ├── content-extraction.ts  # Content metadata extraction
│   ├── screenshot-analysis.ts  # Visual analysis tool
│   └── reputation-check.ts    # Domain reputation checker
└── index.ts                   # Public API exports
```

## Dependencies

- `@mastra/core` - Mastra framework for agent orchestration
- `@ai-sdk/openai` - AI SDK for model integration
- `@safeurl/core` - Shared validation and utilities
- `zod` - Runtime validation
- `neverthrow` - Functional error handling
- `playwright` - Browser automation (for screenshots)

## Agent Workflow

1. **Content Extraction**: Agent extracts URL metadata (title, headers, content hash)
2. **Reputation Check**: Agent checks domain reputation and SSL status
3. **Screenshot Analysis** (if needed): Agent takes screenshots to detect visual phishing patterns
4. **Risk Assessment**: Agent combines all evidence to calculate risk score
5. **Structured Output**: Returns validated risk assessment with reasoning

## Privacy & Security

- **No Content Storage**: Only metadata and hashes are stored
- **SSRF Protection**: All URL validation prevents internal network access
- **Ephemeral Processing**: Screenshots and content processed in memory only
- **Content Hashing**: SHA-256 hashes for verification without storing content

## Model Selection

Uses Qwen2.5-VL-72B-Instruct via OpenRouter:

- **Vision-Language Capabilities**: Can analyze screenshots and visual content
- **Cost-Effective**: Competitive pricing for high-quality analysis
- **Multi-Modal**: Supports text, images, and structured data
- **High Quality**: Strong performance on safety and threat detection tasks

## Development

```bash
# Type checking
bun run typecheck

# Linting (when configured)
bun run lint
```

## Used By

This package is consumed by:

- `@safeurl/worker` - Worker service that processes scan jobs
- `@safeurl/fetcher` - Ephemeral fetcher containers

The agent is invoked during the analysis phase of URL scanning workflows.
