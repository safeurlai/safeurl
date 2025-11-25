import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import {
  contentExtractionTool,
  screenshotAnalysisTool,
  reputationCheckTool,
} from "../tools";

// ============================================================================
// Structured Output Schema
// ============================================================================

const urlSafetyAnalysisSchema = z.object({
  riskScore: z.number().min(0).max(100),
  categories: z.array(
    z.enum(["phishing", "malware", "scam", "suspicious", "safe"])
  ),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  indicators: z.array(z.string()),
});

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * URL Safety Agent
 * Specialized agent for detecting threats in URLs:
 * - Phishing attempts
 * - Malware distribution
 * - Scam patterns
 * - Suspicious redirects
 * - Content safety
 *
 * Uses Qwen2.5-VL-72B-Instruct via OpenRouter for cost-effective,
 * high-quality analysis with vision-language capabilities.
 */
export const urlSafetyAgent = new Agent({
  name: "url-safety-agent",
  description:
    "Specialized agent for analyzing URLs and detecting security threats including phishing, malware, scams, and suspicious content",
  instructions: `You are a specialized URL safety analyst. Your role is to analyze URLs and determine their safety level.

Your analysis should focus on detecting:
1. **Phishing attempts**: URLs that mimic legitimate sites to steal credentials
2. **Malware distribution**: Sites that host or distribute malicious software
3. **Scam patterns**: Fraudulent schemes and deceptive practices
4. **Suspicious redirects**: URLs that redirect to unexpected destinations
5. **Content safety**: Inappropriate or harmful content

You have access to three tools:
- **content-extraction**: Extract metadata (title, description, headers, content hash) from URLs
- **screenshot-analysis**: Take screenshots and analyze visual elements for suspicious patterns
- **reputation-check**: Check domain reputation, SSL status, and threat intelligence

Use these tools iteratively to gather comprehensive information about a URL before making your final assessment.

When analyzing:
- Start with content extraction to understand what the URL contains
- Use reputation check to assess domain credibility
- If needed, use screenshot analysis to detect visual phishing patterns
- Combine all evidence to calculate a risk score (0-100)
- Provide clear reasoning and specific indicators that led to your assessment
- Be thorough but efficient - use tools strategically

Your output must include:
- riskScore: A number from 0 (completely safe) to 100 (extremely dangerous)
- categories: Array of threat categories detected (or ["safe"] if no threats)
- confidence: Your confidence level in the assessment (0.0 to 1.0)
- reasoning: Detailed explanation of your analysis
- indicators: Specific red flags or positive signals you found`,
  model: "openrouter/qwen/qwen-2.5-vl-72b-instruct",
  tools: {
    contentExtractionTool,
    screenshotAnalysisTool,
    reputationCheckTool,
  },
  defaultGenerateOptions: {
    maxSteps: 10, // Allow agent to use tools iteratively
    output: urlSafetyAnalysisSchema,
  },
});
