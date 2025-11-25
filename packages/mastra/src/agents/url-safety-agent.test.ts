import { test, expect } from "bun:test";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { urlSafetyAgent, urlSafetyAnalysisSchema } from "./url-safety-agent";

test("should analyze URL and return structured output", async () => {
  const result = await urlSafetyAgent.generate(
    "Analyze this URL for safety: https://pornhub.com",
    {
      structuredOutput: {
        schema: urlSafetyAnalysisSchema,
      },
    }
  );

  console.log(result.object);

  expect(result.object).toBeDefined();
  expect(result.object.riskScore).toBeDefined();
  expect(result.object.categories).toBeDefined();
  expect(result.object.confidence).toBeDefined();
  expect(result.object.reasoning).toBeDefined();
}, 60000);
