import { Mastra } from "@mastra/core/mastra";
import { urlSafetyAgent } from "./agents/url-safety-agent";

/**
 * Mastra instance for SafeURL
 * Configures the URL safety agent and tools
 */
export const mastra = new Mastra({
  agents: { urlSafetyAgent },
});

// Export public API
export { urlSafetyAgent } from "./agents/url-safety-agent";
export {
  contentExtractionTool,
  screenshotAnalysisTool,
  reputationCheckTool,
} from "./tools";
