import type { Agent } from "@mastra/core/agent";
import { err, ok, Result, type RiskCategory } from "@safeurl/core";

import {
  createUrlSafetyAgent,
  generateWithDebug,
  IMAGE_AND_TOOLS_MODEL,
  urlSafetyAnalysisSchema,
  type UrlSafetyAgentConfig,
} from "./agents/url-safety-agent";

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

export interface UrlAnalysisOutput {
  riskScore: number;
  categories: RiskCategory[];
  confidenceScore: number;
  reasoning: string;
  indicators: string[];
  modelUsed?: string;
  analysisMetadata?: Record<string, unknown>;
}

export interface UrlAnalysisError {
  type: "agent" | "validation" | "timeout" | "parse" | "config";
  message: string;
}

const AGENT_TO_CORE_CATEGORIES: Record<string, RiskCategory> = {
  phishing: "phishing",
  malware: "malware",
  scam: "scam",
  suspicious: "suspicious",
  nsfw: "adult_content",
  safe: "other",
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

function mapCategories(agentCategories: string[]): RiskCategory[] {
  return agentCategories
    .map((cat) => AGENT_TO_CORE_CATEGORIES[cat.toLowerCase()])
    .filter(
      (cat): cat is RiskCategory =>
        cat !== undefined && VALID_RISK_CATEGORIES.includes(cat),
    );
}

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

function mapAgentOutput(
  agentOutput: unknown,
  agentResult: Awaited<ReturnType<Agent["generate"]>>,
): UrlAnalysisOutput {
  if (!agentOutput || typeof agentOutput !== "object") {
    throw new Error("Agent output is not an object");
  }

  const output = agentOutput as Record<string, unknown>;

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
    modelUsed: IMAGE_AND_TOOLS_MODEL,
    analysisMetadata: {
      steps: agentResult.steps?.length || 0,
      tokensUsed: agentResult.usage?.totalTokens || 0,
    },
  };
}

export async function analyzeUrl(
  input: UrlAnalysisInput,
  config: UrlSafetyAgentConfig,
): Promise<Result<UrlAnalysisOutput, UrlAnalysisError>> {
  try {
    if (!config.openRouterApiKey) {
      return err({
        type: "config",
        message: "openRouterApiKey is required in config",
      });
    }

    const agent = createUrlSafetyAgent(config);
    const prompt = formatAnalysisPrompt(input);

    let agentResult: any;
    try {
      agentResult = await generateWithDebug(
        agent,
        [
          {
            role: "user",
            content: prompt,
          },
        ],
        {
          structuredOutput: {
            schema: urlSafetyAnalysisSchema,
          },
        },
      );
    } catch (generateError: any) {
      const errorMessage = String(generateError?.message || generateError);
      if (
        errorMessage.includes("Invalid URL") ||
        errorMessage.includes("Error saving memory")
      ) {
        if (generateError?.result) {
          agentResult = generateError.result;
        } else if (generateError?.object || generateError?.output) {
          agentResult = generateError;
        } else {
          throw generateError;
        }
      } else {
        throw generateError;
      }
    }

    const structuredOutput =
      (agentResult as any)?.object || (agentResult as any)?.output;
    if (!structuredOutput) {
      return err({
        type: "agent",
        message: "Agent did not return structured output",
      });
    }

    const analysis = mapAgentOutput(structuredOutput, agentResult);
    return ok(analysis);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("timeout") || error.message.includes("aborted"))
    ) {
      return err({
        type: "timeout",
        message: `Agent analysis timeout: ${error.message}`,
      });
    }

    if (error instanceof Error && error.message.includes("parse")) {
      return err({
        type: "parse",
        message: `Failed to parse agent output: ${error.message}`,
      });
    }

    return err({
      type: "agent",
      message: `Agent analysis failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    });
  }
}
