import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  contentExtractionTool,
  screenshotAnalysisTool,
  reputationCheckTool,
} from "../tools";
import { executeScreenshotAnalysis } from "../tools/screenshot-analysis";

export const IMAGE_AND_TOOLS_MODEL = "x-ai/grok-4.1-fast:free";

function isImageUrl(url: string): boolean {
  const imageExtensions =
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff|tif)(\?|$)/i;
  return imageExtensions.test(url);
}

function isImageContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  return /^image\//i.test(contentType);
}

function extractUrlFromInput(
  input: Parameters<typeof urlSafetyAgent.generate>[0]
): string | null {
  const urlRegex = /https?:\/\/[^\s]+/i;

  const extractFromText = (text: string): string | null => {
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  };

  const extractFromContent = (content: any): string | null => {
    if (typeof content === "string") return extractFromText(content);
    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === "object" && item && "text" in item) {
          const result = extractFromText(item.text);
          if (result) return result;
        }
      }
    }
    return null;
  };

  if (typeof input === "string") return extractFromText(input);

  if (Array.isArray(input) && input.length > 0) {
    const lastMsg = input[input.length - 1];
    if (typeof lastMsg === "string") return extractFromText(lastMsg);
    if (typeof lastMsg === "object" && lastMsg && "content" in lastMsg) {
      return extractFromContent((lastMsg as any).content);
    }
  }

  if (typeof input === "object" && input && "messages" in input) {
    const messages = (input as any).messages;
    if (Array.isArray(messages) && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (typeof lastMsg === "string") return extractFromText(lastMsg);
      if (typeof lastMsg === "object" && lastMsg && "content" in lastMsg) {
        return extractFromContent(lastMsg.content);
      }
    }
  }

  return null;
}

export const urlSafetyAnalysisSchema = z.object({
  riskScore: z.number().min(0).max(100),
  categories: z.array(
    z.enum(["phishing", "malware", "scam", "suspicious", "nsfw", "safe"])
  ),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  indicators: z.array(z.string()),
});

export interface UrlSafetyAgentConfig {
  openRouterApiKey: string;
}

export function createUrlSafetyAgent(config: UrlSafetyAgentConfig): Agent {
  if (!config.openRouterApiKey) {
    throw new Error("openRouterApiKey is required to create urlSafetyAgent");
  }

  const openrouter = createOpenRouter({
    apiKey: config.openRouterApiKey,
  });

  const agent = new Agent({
    name: "url-safety-agent",
    description:
      "Detects phishing, malware, scams, NSFW, and suspicious content via visual analysis",
    instructions: `Visual safety analyst detecting phishing, malware, scams, NSFW, and suspicious content.

Image URLs: If image attached, analyze directly for NSFW/explicit content and threats.
Workflow: 1) screenshot-analysis (visual), 2) content-extraction (metadata), 3) reputation-check (domain).
Detect: phishing layouts, fake logins, NSFW imagery, suspicious patterns, malware indicators.
Be accurate - minimize false positives.`,
    model: openrouter(IMAGE_AND_TOOLS_MODEL),
    tools: {
      contentExtractionTool,
      screenshotAnalysisTool,
      reputationCheckTool,
    },
    defaultGenerateOptions: {
      maxSteps: 10,
      output: urlSafetyAnalysisSchema,
    },
  });

  return agent;
}

export const urlSafetyAgent = createUrlSafetyAgent({
  openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
});

export async function generateWithDebug(
  agent: Agent,
  input: Parameters<Agent["generate"]>[0],
  options?: Parameters<Agent["generate"]>[1]
): Promise<ReturnType<Agent["generate"]>> {
  const detectedUrl = extractUrlFromInput(input);

  // Check if URL has image extension
  const hasImageExtension = detectedUrl ? isImageUrl(detectedUrl) : false;

  // Also check contentType from prompt if available
  // Extract contentType from prompt text (format: "Content Type: image/jpeg")
  let contentType: string | null = null;
  if (typeof input === "string") {
    const contentTypeMatch = input.match(/Content Type:\s*([^\n]+)/i);
    if (contentTypeMatch) {
      contentType = contentTypeMatch[1].trim();
    }
  } else if (Array.isArray(input) && input.length > 0) {
    const lastMsg = input[input.length - 1];
    if (typeof lastMsg === "object" && lastMsg && "content" in lastMsg) {
      const content = (lastMsg as any).content;
      const contentStr =
        typeof content === "string"
          ? content
          : Array.isArray(content)
          ? content
              .map((c: any) => (typeof c === "string" ? c : c?.text || ""))
              .join(" ")
          : "";
      const contentTypeMatch = contentStr.match(/Content Type:\s*([^\n]+)/i);
      if (contentTypeMatch) {
        contentType = contentTypeMatch[1].trim();
      }
    }
  }

  const isImage = hasImageExtension || isImageContentType(contentType);

  let enhancedInput = input;

  if (isImage && detectedUrl) {
    const screenshotResult = await executeScreenshotAnalysis({
      url: detectedUrl,
      viewport: {
        width: 1024,
        height: 1024,
      },
      imageFormat: "jpeg",
      quality: 85,
    });

    if (screenshotResult.isOk() && screenshotResult.value.screenshotBase64) {
      const imageBase64 = screenshotResult.value.screenshotBase64;
      const imageAttachment = {
        type: "image" as const,
        image: imageBase64,
        mimeType: "image/jpeg" as const,
      };

      const normalizeContent = (content: any): any[] => {
        if (Array.isArray(content)) return [...content];
        if (typeof content === "string")
          return [{ type: "text", text: content }];
        return [content];
      };

      const addImageToMessages = (messages: any[]): any[] => {
        const msgs = [...messages];
        const lastMsg = msgs[msgs.length - 1];

        if (
          lastMsg &&
          typeof lastMsg === "object" &&
          "role" in lastMsg &&
          lastMsg.role
        ) {
          const content = normalizeContent((lastMsg as any).content);
          content.push(imageAttachment);
          msgs[msgs.length - 1] = { ...lastMsg, content };
        } else {
          msgs.push({ role: "user", content: [imageAttachment] });
        }
        return msgs;
      };

      if (typeof input === "string") {
        enhancedInput = [
          {
            role: "user",
            content: [{ type: "text", text: input }, imageAttachment],
          },
        ] as any;
      } else if (Array.isArray(input)) {
        enhancedInput = addImageToMessages(input) as any;
      } else if (typeof input === "object" && input && "messages" in input) {
        enhancedInput = {
          ...input,
          messages: addImageToMessages((input as any).messages),
        } as any;
      }
    } else {
      if (typeof input === "string") {
        enhancedInput =
          `${input}\n\nNote: This is an image URL (${detectedUrl}), but screenshot capture failed. Please analyze the URL metadata.` as any;
      }
    }
  }

  try {
    return await agent.generate(enhancedInput, options);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    if (
      errorMessage.includes("Invalid URL") ||
      errorMessage.includes("Error saving memory")
    ) {
      if (error?.result) {
        return error.result;
      }
      if (error?.object || error?.output) {
        return error;
      }
    }
    throw error;
  }
}
