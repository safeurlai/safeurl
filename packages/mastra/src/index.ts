import { Mastra } from "@mastra/core/mastra";

import {
  createUrlSafetyAgent,
  type UrlSafetyAgentConfig,
} from "./agents/url-safety-agent";

export function createMastraInstance(config: UrlSafetyAgentConfig) {
  const agent = createUrlSafetyAgent(config);
  return new Mastra({
    agents: { urlSafetyAgent: agent },
  });
}

export {
  createUrlSafetyAgent,
  type UrlSafetyAgentConfig,
} from "./agents/url-safety-agent";
export {
  contentExtractionTool,
  createScreenshotAnalysisTool,
  reputationCheckTool,
  type ScreenshotGenerator,
  type ScreenshotOptions,
  type ScreenshotMetadata,
  type ScreenshotResult,
} from "./tools";
export {
  analyzeUrl,
  type UrlAnalysisInput,
  type UrlAnalysisOutput,
  type UrlAnalysisError,
} from "./analyze-url";
