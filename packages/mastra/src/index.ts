import { Mastra } from "@mastra/core/mastra";

import {
  createUrlSafetyAgent,
  urlSafetyAgent,
  type UrlSafetyAgentConfig,
} from "./agents/url-safety-agent";

export const mastra = new Mastra({
  agents: { urlSafetyAgent },
});

export function createMastraInstance(config: UrlSafetyAgentConfig) {
  const agent = createUrlSafetyAgent(config);
  return new Mastra({
    agents: { urlSafetyAgent: agent },
  });
}

export {
  urlSafetyAgent,
  createUrlSafetyAgent,
  type UrlSafetyAgentConfig,
} from "./agents/url-safety-agent";
export {
  contentExtractionTool,
  screenshotAnalysisTool,
  reputationCheckTool,
} from "./tools";
export {
  analyzeUrl,
  type UrlAnalysisInput,
  type UrlAnalysisOutput,
  type UrlAnalysisError,
} from "./analyze-url";
