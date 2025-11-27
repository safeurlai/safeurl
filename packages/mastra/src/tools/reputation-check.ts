import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { extractDomain } from "@safeurl/core/utils";
import { Result, ok, err } from "neverthrow";
import { safeFetch } from "@safeurl/core/result";

const reputationCheckInputSchema = z.object({
  domain: z.string(),
  url: z.string().url().optional(),
});

const reputationCheckOutputSchema = z.object({
  reputationScore: z.number().min(0).max(100),
  threatIntel: z
    .object({
      isMalicious: z.boolean(),
      categories: z.array(z.string()),
      sources: z.array(z.string()),
    })
    .optional(),
  domainAge: z.number().optional(),
  sslInfo: z
    .object({
      isValid: z.boolean(),
      issuer: z.string().optional(),
    })
    .optional(),
});

async function executeReputationCheck(
  input: z.infer<typeof reputationCheckInputSchema>
): Promise<Result<z.infer<typeof reputationCheckOutputSchema>, string>> {
  let domain: string;
  if (input.url) {
    const extracted = extractDomain(input.url);
    if (!extracted) {
      return err("Invalid URL provided");
    }
    domain = extracted;
  } else {
    domain = input.domain.toLowerCase().trim();
  }

  if (!domain || domain.length === 0) {
    return err("Invalid domain");
  }

  let sslInfo: z.infer<typeof reputationCheckOutputSchema>["sslInfo"];
  const urlToCheck = input.url || `https://${domain}`;

  try {
    const fetchResult = await safeFetch<Response>(urlToCheck, {
      parseJson: false,
      method: "HEAD",
    });

    if (fetchResult.isOk()) {
      sslInfo = {
        isValid: true,
        issuer: "Verified",
      };
    } else {
      const error = fetchResult.error;
      if (error.type === "network") {
        sslInfo = {
          isValid: false,
        };
      } else {
        sslInfo = {
          isValid: true,
        };
      }
    }
  } catch {
    sslInfo = {
      isValid: false,
    };
  }

  let reputationScore = 50;

  const suspiciousPatterns = [
    /[0-9]{4,}/, // Many numbers
    /[a-z]{1,2}[0-9]{3,}/, // Short letters + many numbers
    /bit\.ly|tinyurl|t\.co|goo\.gl/i,
  ];

  let isSuspicious = false;
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(domain)) {
      isSuspicious = true;
      reputationScore -= 20;
      break;
    }
  }

  if (domain.length < 5) {
    reputationScore -= 10;
    isSuspicious = true;
  }

  if (sslInfo?.isValid) {
    reputationScore += 20;
  }

  const commonTlds = [".com", ".org", ".net", ".edu", ".gov"];
  const hasCommonTld = commonTlds.some((tld) => domain.endsWith(tld));
  if (hasCommonTld) {
    reputationScore += 10;
  }

  reputationScore = Math.max(0, Math.min(100, reputationScore));

  const threatIntel: z.infer<
    typeof reputationCheckOutputSchema
  >["threatIntel"] = isSuspicious
    ? {
        isMalicious: false,
        categories: ["suspicious-pattern"],
        sources: ["heuristic-analysis"],
      }
    : undefined;

  const domainAge: number | undefined = undefined;

  return ok({
    reputationScore,
    threatIntel,
    domainAge,
    sslInfo,
  });
}

export const reputationCheckTool = createTool({
  id: "reputation-check",
  description:
    "Checks domain reputation using heuristics, SSL validation, and pattern analysis.",
  inputSchema: reputationCheckInputSchema,
  outputSchema: reputationCheckOutputSchema,
  execute: async ({
    context,
  }: {
    context: z.infer<typeof reputationCheckInputSchema>;
  }) => {
    const result = await executeReputationCheck(context);
    if (result.isErr()) {
      throw new Error(result.error);
    }
    return result.value;
  },
});
