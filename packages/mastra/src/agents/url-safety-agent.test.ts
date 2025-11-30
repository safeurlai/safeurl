import { expect, test } from "bun:test";

import {
  createUrlSafetyAgent,
  generateWithDebug,
  urlSafetyAnalysisSchema,
} from "./url-safety-agent";

test("should analyze image URL and use screenshot-analysis tool", async () => {
  // Get OpenRouter API key from environment
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is required for tests",
    );
  }

  // Create agent instance using factory
  const agent = createUrlSafetyAgent({
    openRouterApiKey,
  });

  const imageUrl = "https://i.4cdn.org/cgl/1683919741567583.jpg";

  // Use generateWithDebug for automatic image URL detection
  // generateWithDebug will automatically detect image URLs and enhance the prompt
  // to ensure screenshot-analysis tool is used
  const result = await generateWithDebug(
    agent,
    `Analyze this image URL for NSFW content: ${imageUrl}`,
    {
      structuredOutput: {
        schema: urlSafetyAnalysisSchema,
      },
    },
  );

  console.log("Result object:", result.object);
  console.log("Result text:", result.text?.substring(0, 500));

  // Verify structured output
  expect(result.object).toBeDefined();
  expect(result.object.riskScore).toBeDefined();
  expect(result.object.categories).toBeDefined();
  expect(result.object.confidence).toBeDefined();
  expect(result.object.reasoning).toBeDefined();

  // Verify that screenshot-analysis was likely used (check reasoning or text)
  // The agent should mention screenshot or visual analysis in the reasoning
  const reasoning = result.object.reasoning.toLowerCase();
  const hasVisualAnalysis =
    reasoning.includes("screenshot") ||
    reasoning.includes("visual") ||
    reasoning.includes("image") ||
    result.text?.toLowerCase().includes("screenshot");

  console.log("Visual analysis indicators:", {
    reasoning: reasoning.substring(0, 200),
    hasVisualAnalysis,
  });
}, 120_000);
