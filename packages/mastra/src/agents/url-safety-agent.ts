import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  contentExtractionTool,
  screenshotAnalysisTool,
  reputationCheckTool,
} from "../tools";

// ============================================================================
// Structured Output Schema
// ============================================================================

export const urlSafetyAnalysisSchema = z.object({
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

// ============================================================================
// OpenRouter Provider Configuration
// ============================================================================

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
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
 * Uses Grok-4.1-Fast (free tier) via OpenRouter for high-quality analysis with
 * excellent tool use capabilities.
 */
export const urlSafetyAgent = new Agent({
  name: "url-safety-agent",
  description:
    "URL safety analyst detecting phishing, malware, scams, and suspicious content",
  instructions: `Analyze URLs for safety threats: phishing, malware, scams, suspicious redirects, and harmful content.

Use tools iteratively:
1. content-extraction: Get URL metadata
2. reputation-check: Verify domain credibility  
3. screenshot-analysis: Detect visual phishing patterns

After completing your analysis, you must return a JSON object with the following structure:
{
  "riskScore": <number 0-100>,
  "categories": <array of strings from: "phishing", "malware", "scam", "suspicious", "safe">,
  "confidence": <number 0-1>,
  "reasoning": <string explaining your analysis>,
  "indicators": <array of strings describing specific indicators found>
}

Return ONLY valid JSON, no additional text before or after.`,
  model: openrouter("x-ai/grok-4.1-fast:free"),
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
