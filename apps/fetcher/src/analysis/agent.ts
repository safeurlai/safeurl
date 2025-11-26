/**
 * Mastra Agent Analysis Module
 * 
 * Invokes Mastra agent to analyze URL metadata and return structured results.
 * Explicitly excludes content body - only passes metadata and hash.
 */

import { analyzeUrl, type UrlAnalysisInput, type UrlAnalysisOutput } from "@safeurl/mastra";
import { Result, err, ok } from "@safeurl/core";
import { scanResultSchema, type RiskCategory } from "@safeurl/core";

// ============================================================================
// Types
// ============================================================================

// Re-export types from mastra package for convenience
export type AgentAnalysisInput = UrlAnalysisInput;

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
  // Get OpenRouter API key from environment
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    return err({
      type: "agent",
      message: "OPENROUTER_API_KEY environment variable is required",
    });
  }

  // Use high-level analysis function from mastra package
  const analysisResult = await analyzeUrl(input, {
    openRouterApiKey,
    debugEnabled: process.env.DEBUG_AGENT === "true",
  });

  if (analysisResult.isErr()) {
    // Map mastra error types to fetcher error types
    const error = analysisResult.error;
    return err({
      type: error.type === "config" ? "agent" : error.type,
      message: error.message,
    });
  }

  const analysis = analysisResult.value;

  // Validate against schema (includes contentHash, httpStatus, etc. from input)
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

  return ok({
    riskScore: analysis.riskScore,
    categories: analysis.categories,
    confidenceScore: analysis.confidenceScore,
    reasoning: analysis.reasoning,
    indicators: analysis.indicators,
    modelUsed: analysis.modelUsed,
    analysisMetadata: analysis.analysisMetadata,
  });
}

