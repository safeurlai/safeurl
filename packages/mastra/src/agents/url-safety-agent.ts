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
    z.enum(["phishing", "malware", "scam", "suspicious", "nsfw", "safe"])
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
 * - NSFW/adult content
 * - Content safety
 *
 * Uses Grok-4.1-Fast (free tier) via OpenRouter for high-quality analysis with
 * excellent tool use capabilities.
 */
export const urlSafetyAgent = new Agent({
  name: "url-safety-agent",
  description:
    "URL safety analyst detecting phishing, malware, scams, NSFW content, and suspicious activity",
  instructions: `Analyze URLs for safety threats: phishing, malware, scams, suspicious redirects, NSFW/adult content, and harmful material.

Use tools iteratively:
1. content-extraction: Get URL metadata (title, description, headers) - look for adult/NSFW keywords
2. reputation-check: Verify domain credibility and check for known adult content domains
3. screenshot-analysis: Detect visual patterns including NSFW imagery, phishing layouts, and suspicious content

NSFW Detection Guidelines:
- Check page title and description for adult content keywords (explicit terms, adult services, etc.)
- Analyze visual content in screenshots for explicit imagery, adult themes, or inappropriate material
- Look for domain patterns commonly associated with adult content sites
- Consider metadata and headers that may indicate adult content categories
- Be thorough but accurate - false positives can be problematic`,
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
