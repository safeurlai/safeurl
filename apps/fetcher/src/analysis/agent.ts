/**
 * Mastra Agent Analysis Module
 * 
 * Invokes Mastra agent to analyze URL metadata and return structured results.
 * Explicitly excludes content body - only passes metadata and hash.
 */

import { urlSafetyAgent } from "@safeurl/mastra";
import { Result, err, ok } from "@safeurl/core";
import { scanResultSchema, RiskCategory } from "@safeurl/core";

// ============================================================================
// Types
// ============================================================================

export interface AgentAnalysisInput {
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

export interface AgentAnalysisResult {
  riskScore: number;
  categories: RiskCategory[];
  confidenceScore: number;
  reasoning: string;
  indicators: string[];
  modelUsed?: string;
  analysisMetadata?: Record<string, unknown>;
}

export interface AgentAnalysisError {
  type: "agent" | "validation" | "timeout" | "parse";
  message: string;
}

// ============================================================================
// Agent Analysis
// ============================================================================

/**
 * Analyzes URL metadata using Mastra agent
 * 
 * @param input - Analysis input (metadata only, no content)
 * @returns Result with analysis data
 */
export async function analyzeWithAgent(
  input: AgentAnalysisInput
): Promise<Result<AgentAnalysisResult, AgentAnalysisError>> {
  try {
    // Prepare context for agent (metadata only, explicitly no content)
    const agentContext = {
      url: input.url,
      contentHash: input.contentHash,
      httpStatus: input.httpStatus,
      httpHeaders: input.httpHeaders,
      contentType: input.contentType,
      metadata: input.metadata,
      // Explicitly note: NO content body is included
    };

    // Invoke agent with structured output
    const agentResult = await urlSafetyAgent.generate({
      messages: [
        {
          role: "user",
          content: `Analyze this URL for safety threats. Here's the metadata:

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
to gather additional information if needed.`,
        },
      ],
    });

    // Extract structured output
    if (!agentResult.output) {
      return err({
        type: "agent",
        message: "Agent did not return output",
      });
    }

    // Validate output structure
    const output = agentResult.output as unknown;

    // Map agent output to our schema
    // The agent returns: { riskScore, categories, confidence, reasoning, indicators }
    const analysis: AgentAnalysisResult = {
      riskScore:
        typeof output === "object" &&
        output !== null &&
        "riskScore" in output &&
        typeof output.riskScore === "number"
          ? Math.max(0, Math.min(100, Math.round(output.riskScore)))
          : 0,
      categories:
        typeof output === "object" &&
        output !== null &&
        "categories" in output &&
        Array.isArray(output.categories)
          ? (output.categories as string[]).filter((cat): cat is RiskCategory =>
              [
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
              ].includes(cat)
            )
          : [],
      confidenceScore:
        typeof output === "object" &&
        output !== null &&
        "confidence" in output &&
        typeof output.confidence === "number"
          ? Math.max(0, Math.min(1, output.confidence))
          : 0.5,
      reasoning:
        typeof output === "object" &&
        output !== null &&
        "reasoning" in output &&
        typeof output.reasoning === "string"
          ? output.reasoning
          : "No reasoning provided",
      indicators:
        typeof output === "object" &&
        output !== null &&
        "indicators" in output &&
        Array.isArray(output.indicators)
          ? (output.indicators as unknown[]).map((ind) => String(ind))
          : [],
      modelUsed: agentResult.modelUsed || "unknown",
      analysisMetadata: {
        steps: agentResult.steps?.length || 0,
        tokensUsed: agentResult.usage?.totalTokens || 0,
      },
    };

    // Validate against schema
    const validation = scanResultSchema.safeParse({
      riskScore: analysis.riskScore,
      categories: analysis.categories,
      confidenceScore: analysis.confidenceScore,
      reasoning: analysis.reasoning,
      indicators: analysis.indicators,
      contentHash: input.contentHash,
      httpStatus: input.httpStatus,
      httpHeaders: input.httpHeaders,
      contentType: input.contentType,
      modelUsed: analysis.modelUsed || "unknown",
      analysisMetadata: analysis.analysisMetadata,
    });

    if (!validation.success) {
      return err({
        type: "validation",
        message: `Agent output validation failed: ${validation.error.message}`,
      });
    }

    return ok(analysis);
  } catch (error) {
    // Handle timeout errors
    if (
      error instanceof Error &&
      (error.message.includes("timeout") ||
        error.message.includes("aborted"))
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

