import { Mastra } from "@mastra/core/mastra";
import {
  urlSafetyAgent,
  createUrlSafetyAgent,
  type UrlSafetyAgentConfig,
} from "./agents/url-safety-agent";

/**
 * Mastra instance for SafeURL (uses default singleton agent)
 * Configures the URL safety agent and tools
 *
 * @deprecated Use createMastraInstance() factory function instead
 */
export const mastra = new Mastra({
  agents: { urlSafetyAgent },
});

/**
 * Factory function to create a Mastra instance with custom agent configuration
 *
 * @param config - Configuration for the URL safety agent
 * @returns Configured Mastra instance
 */
export function createMastraInstance(config: UrlSafetyAgentConfig) {
  const agent = createUrlSafetyAgent(config);
  return new Mastra({
    agents: { urlSafetyAgent: agent },
  });
}

// Export public API
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
