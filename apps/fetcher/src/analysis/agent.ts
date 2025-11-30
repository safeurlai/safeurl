import {
  err,
  ok,
  Result,
  scanResultSchema,
  type RiskCategory,
} from "@safeurl/core";
import { analyzeUrl, type UrlAnalysisInput } from "@safeurl/mastra";

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

export async function analyzeWithAgent(
  input: AgentAnalysisInput,
): Promise<Result<AgentAnalysisResult, AgentAnalysisError>> {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    return err({
      type: "agent",
      message:
        "OPENROUTER_API_KEY environment variable is required. Get your API key from https://openrouter.ai/keys",
    });
  }

  if (!openRouterApiKey.startsWith("sk-or-")) {
    return err({
      type: "agent",
      message:
        "Invalid OPENROUTER_API_KEY format. OpenRouter API keys should start with 'sk-or-'. Get your API key from https://openrouter.ai/keys",
    });
  }

  const analysisResult = await analyzeUrl(input, {
    openRouterApiKey,
  });

  if (analysisResult.isErr()) {
    const error = analysisResult.error;

    return err({
      type: error.type === "config" ? "agent" : error.type,
      message: error.message,
    });
  }

  const analysis = analysisResult.value;

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
