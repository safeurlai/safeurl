/**
 * High-level URL analysis function
 *
 * Provides a simplified API for analyzing URLs using the Mastra agent.
 * Handles prompt formatting, output mapping, and error handling.
 */

import { Result, err, ok } from "@safeurl/core";
import type { RiskCategory } from "@safeurl/core";
import {
  createUrlSafetyAgent,
  type UrlSafetyAgentConfig,
} from "./agents/url-safety-agent";
import type { Agent } from "@mastra/core/agent";

// ============================================================================
// Types
// ============================================================================

/**
 * Input for URL analysis
 */
export interface UrlAnalysisInput {
  url: string;
  contentHash: string;
  httpStatus: number | null;
  httpHeaders: Record<string, string>;
  contentType: string | null;
  metadata: {
    title?: string;
    description?: string;
    metaTags?: Record<string, string>;
    linkCount?: number;
  };
}

/**
 * Output from URL analysis
 */
export interface UrlAnalysisOutput {
  riskScore: number;
  categories: RiskCategory[];
  confidenceScore: number;
  reasoning: string;
  indicators: string[];
  modelUsed?: string;
  analysisMetadata?: Record<string, unknown>;
}

/**
 * Analysis error types
 */
export interface UrlAnalysisError {
  type: "agent" | "validation" | "timeout" | "parse" | "config";
  message: string;
}

// ============================================================================
// Category Mapping
// ============================================================================

/**
 * Maps agent output categories to core RiskCategory enum
 */
const AGENT_TO_CORE_CATEGORIES: Record<string, RiskCategory> = {
  phishing: "phishing",
  malware: "malware",
  scam: "scam",
  suspicious: "suspicious",
  nsfw: "adult_content",
  safe: "other", // "safe" maps to "other" since it's not a risk category
};

const VALID_RISK_CATEGORIES: RiskCategory[] = [
  "malware",
  "phishing",
  "scam",
  "suspicious",
  "adult_content",
  "violence",
  "illegal_content",
  "misinformation",
  "spam",
  "other",
];

/**
 * Maps agent category strings to core RiskCategory enum
 */
function mapCategories(agentCategories: string[]): RiskCategory[] {
  return agentCategories
    .map((cat) => AGENT_TO_CORE_CATEGORIES[cat.toLowerCase()])
    .filter(
      (cat): cat is RiskCategory =>
        cat !== undefined && VALID_RISK_CATEGORIES.includes(cat)
    );
}

// ============================================================================
// Prompt Formatting
// ============================================================================

/**
 * Formats URL metadata into a prompt for the agent
 */
function formatAnalysisPrompt(input: UrlAnalysisInput): string {
  return `Analyze this URL for safety threats. Here's the metadata:

URL: ${input.url}
Content Hash: ${input.contentHash}
HTTP Status: ${input.httpStatus || "N/A"}
Content Type: ${input.contentType || "N/A"}
Title: ${input.metadata.title || "N/A"}
Description: ${input.metadata.description || "N/A"}
Meta Tags: ${JSON.stringify(input.metadata.metaTags || {})}
Link Count: ${input.metadata.linkCount || 0}

Note: Only metadata is provided (no content body) for privacy and security reasons.
Use the available tools (content-extraction, screenshot-analysis, reputation-check) 
to gather additional information if needed.`;
}

// ============================================================================
// Output Mapping
// ============================================================================

/**
 * Maps agent output to UrlAnalysisOutput format
 */
function mapAgentOutput(
  agentOutput: unknown,
  agentResult: Awaited<ReturnType<Agent["generate"]>>
): UrlAnalysisOutput {
  if (!agentOutput || typeof agentOutput !== "object") {
    throw new Error("Agent output is not an object");
  }

  const output = agentOutput as Record<string, unknown>;
  const resultAny = agentResult as any;

  return {
    riskScore:
      typeof output.riskScore === "number"
        ? Math.max(0, Math.min(100, Math.round(output.riskScore)))
        : 0,
    categories: Array.isArray(output.categories)
      ? mapCategories(output.categories.map(String))
      : [],
    confidenceScore:
      typeof output.confidence === "number"
        ? Math.max(0, Math.min(1, output.confidence))
        : 0.5,
    reasoning:
      typeof output.reasoning === "string"
        ? output.reasoning
        : "No reasoning provided",
    indicators: Array.isArray(output.indicators)
      ? output.indicators.map((ind) => String(ind))
      : [],
    modelUsed: resultAny.modelUsed || resultAny.model || "unknown",
    analysisMetadata: {
      steps: resultAny.steps?.length || 0,
      tokensUsed: resultAny.usage?.totalTokens || 0,
    },
  };
}

// ============================================================================
// High-Level Analysis Function
// ============================================================================

/**
 * Analyzes a URL using the Mastra agent
 *
 * This is a high-level convenience function that:
 * - Creates an agent instance with the provided config
 * - Formats the prompt from metadata
 * - Invokes the agent
 * - Maps the output to the expected format
 * - Handles errors appropriately
 *
 * @param input - URL metadata to analyze
 * @param config - Agent configuration (API key, debug settings, etc.)
 * @returns Result with analysis output or error
 */
export async function analyzeUrl(
  input: UrlAnalysisInput,
  config: UrlSafetyAgentConfig
): Promise<Result<UrlAnalysisOutput, UrlAnalysisError>> {
  try {
    // Validate config
    if (!config.openRouterApiKey) {
      return err({
        type: "config",
        message: "openRouterApiKey is required in config",
      });
    }

    // Create agent instance
    const agent = createUrlSafetyAgent(config);

    // Format prompt
    const prompt = formatAnalysisPrompt(input);

    // Invoke agent (Mastra agent.generate accepts messages array directly)
    const agentResult = await agent.generate([
      {
        role: "user",
        content: prompt,
      },
    ]);

    // Extract structured output (Mastra uses 'object' property for structured output)
    const structuredOutput =
      (agentResult as any).object || (agentResult as any).output;
    if (!structuredOutput) {
      return err({
        type: "agent",
        message: "Agent did not return structured output",
      });
    }

    // Map output to expected format
    const analysis = mapAgentOutput(structuredOutput, agentResult);

    return ok(analysis);
  } catch (error) {
    // Handle timeout errors
    if (
      error instanceof Error &&
      (error.message.includes("timeout") || error.message.includes("aborted"))
    ) {
      return err({
        type: "timeout",
        message: `Agent analysis timeout: ${error.message}`,
      });
    }

    // Handle parsing errors
    if (error instanceof Error && error.message.includes("parse")) {
      return err({
        type: "parse",
        message: `Failed to parse agent output: ${error.message}`,
      });
    }

    // Generic agent error
    return err({
      type: "agent",
      message: `Agent analysis failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    });
  }
}
