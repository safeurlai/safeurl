import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { extractDomain } from "@safeurl/core/utils";
import { Result, ok, err } from "neverthrow";
import { safeFetch } from "@safeurl/core/result";

// ============================================================================
// Schemas
// ============================================================================

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

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Checks domain reputation and SSL information
 * Performs basic checks without requiring external threat intel APIs
 */
async function executeReputationCheck(
  input: z.infer<typeof reputationCheckInputSchema>
): Promise<Result<z.infer<typeof reputationCheckOutputSchema>, string>> {
  // Step 1: Extract domain from URL if provided, otherwise use provided domain
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

  // Step 2: Basic domain validation
  if (!domain || domain.length === 0) {
    return err("Invalid domain");
  }

  // Step 3: Check SSL certificate (if HTTPS)
  let sslInfo: z.infer<typeof reputationCheckOutputSchema>["sslInfo"];
  const urlToCheck = input.url || `https://${domain}`;

  try {
    // Try to fetch the URL to check SSL
    const fetchResult = await safeFetch<Response>(urlToCheck, {
      parseJson: false,
      method: "HEAD", // Use HEAD to avoid downloading content
    });

    if (fetchResult.isOk()) {
      // SSL is valid if we got a response
      sslInfo = {
        isValid: true,
        issuer: "Verified", // In a real implementation, extract from certificate
      };
    } else {
      const error = fetchResult.error;
      if (error.type === "network") {
        // Network error might indicate SSL issues
        sslInfo = {
          isValid: false,
        };
      } else {
        // HTTP error doesn't mean SSL is invalid
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

  // Step 4: Calculate reputation score based on basic heuristics
  let reputationScore = 50; // Start with neutral score

  // Check for suspicious domain patterns
  const suspiciousPatterns = [
    /[0-9]{4,}/, // Many numbers
    /[a-z]{1,2}[0-9]{3,}/, // Short letters + many numbers
    /bit\.ly|tinyurl|t\.co|goo\.gl/i, // URL shorteners (lower reputation)
  ];

  let isSuspicious = false;
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(domain)) {
      isSuspicious = true;
      reputationScore -= 20;
      break;
    }
  }

  // Check domain length (very short domains might be suspicious)
  if (domain.length < 5) {
    reputationScore -= 10;
    isSuspicious = true;
  }

  // Boost score if SSL is valid
  if (sslInfo?.isValid) {
    reputationScore += 20;
  }

  // Boost score for common TLDs
  const commonTlds = [".com", ".org", ".net", ".edu", ".gov"];
  const hasCommonTld = commonTlds.some((tld) => domain.endsWith(tld));
  if (hasCommonTld) {
    reputationScore += 10;
  }

  // Ensure score is within bounds
  reputationScore = Math.max(0, Math.min(100, reputationScore));

  // Step 5: Build threat intelligence object (basic)
  const threatIntel: z.infer<
    typeof reputationCheckOutputSchema
  >["threatIntel"] = isSuspicious
    ? {
        isMalicious: false, // We don't have definitive proof
        categories: ["suspicious-pattern"],
        sources: ["heuristic-analysis"],
      }
    : undefined;

  // Step 6: Domain age lookup (placeholder - would require external API)
  // For now, we'll skip this as it requires external services
  const domainAge: number | undefined = undefined;

  return ok({
    reputationScore,
    threatIntel,
    domainAge,
    sslInfo,
  });
}

/**
 * Reputation check tool for Mastra agent
 * Checks domain reputation using basic heuristics and SSL validation
 */
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
