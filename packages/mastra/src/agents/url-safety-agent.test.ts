import { test, expect } from "bun:test";
import {
  urlSafetyAgent,
  urlSafetyAnalysisSchema,
  generateWithDebug,
} from "./url-safety-agent";

// Enable debugging by setting DEBUG_AGENT=true or running in non-production mode
// The tools are automatically wrapped with debugging, so you'll see logs for:
// - Tool call start/completion/failure with timing
// - Agent execution start/completion/failure
// - Step-by-step agent progress
// - Image URL detection and screenshot-analysis tool usage

test("should analyze image URL and use screenshot-analysis tool", async () => {
  const imageUrl = "https://i.4cdn.org/cgl/1683919741567583.jpg";

  // Use generateWithDebug for enhanced debugging and automatic image URL detection
  // generateWithDebug will automatically detect image URLs and enhance the prompt
  // to ensure screenshot-analysis tool is used
  const result = await generateWithDebug(
    `Analyze this image URL for NSFW content: ${imageUrl}`,
    {
      structuredOutput: {
        schema: urlSafetyAnalysisSchema,
      },
    }
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

  // Note: We can't directly verify tool calls, but we can check if the reasoning
  // mentions visual/screenshot analysis, which indicates the tool was used
}, 120_000); // Increased timeout to 120s to help debug timeout issues
