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

// ============================================================================
// Debugging Utilities
// ============================================================================
//
// Debugging is automatically enabled when:
// - DEBUG_AGENT=true environment variable is set, OR
// - NODE_ENV is not "production"
//
// Debug logs include:
// - Tool call start/completion/failure with timing
// - Agent execution start/completion/failure
// - Step-by-step agent progress (when using generateWithDebug)
//
// To enable debugging: export DEBUG_AGENT=true before running your code
// To use enhanced debugging: import and use generateWithDebug() instead of urlSafetyAgent.generate()

const DEBUG_ENABLED =
  process.env.DEBUG_AGENT === "true" || process.env.NODE_ENV !== "production";

function debugLog(message: string, data?: any) {
  if (DEBUG_ENABLED) {
    const timestamp = new Date().toISOString();
    if (data !== undefined) {
      console.log(`[${timestamp}] [URL-SAFETY-AGENT] ${message}`, data);
    } else {
      console.log(`[${timestamp}] [URL-SAFETY-AGENT] ${message}`);
    }
  }
}

// Wrap tool execution with timing and debugging
function wrapToolWithDebugging<
  T extends { execute: (...args: any[]) => Promise<any> }
>(tool: T, toolName: string): T {
  const originalExecute = tool.execute.bind(tool);

  return {
    ...tool,
    execute: async (...args: any[]) => {
      const startTime = Date.now();
      debugLog(`🔧 Tool: ${toolName}`, {
        args: args.length > 0 ? JSON.stringify(args[0]).substring(0, 100) : "none",
      });

      try {
        const result = await originalExecute(...args);
        const duration = Date.now() - startTime;
        debugLog(`✅ Tool: ${toolName}`, {
          duration: `${duration}ms`,
          resultPreview:
            typeof result === "object"
              ? JSON.stringify(result).substring(0, 100)
              : String(result).substring(0, 100),
        });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        debugLog(`❌ Tool: ${toolName}`, {
          duration: `${duration}ms`,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  } as T;
}

// ============================================================================
// Image URL Detection
// ============================================================================

/**
 * Detects if a URL points to an image file
 */
function isImageUrl(url: string): boolean {
  const imageExtensions =
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff|tif)(\?|$)/i;
  return imageExtensions.test(url);
}

/**
 * Extracts URL from input (string, array, or messages object)
 */
function extractUrlFromInput(
  input: Parameters<typeof urlSafetyAgent.generate>[0]
): string | null {
  const urlRegex = /https?:\/\/[^\s]+/i;
  
  // Helper to extract URL from text
  const extractFromText = (text: string): string | null => {
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  };

  // Helper to extract from content
  const extractFromContent = (content: any): string | null => {
    if (typeof content === "string") return extractFromText(content);
    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === "object" && item && "text" in item) {
          const result = extractFromText((item as any).text);
          if (result) return result;
        }
      }
    }
    return null;
  };

  // Handle string input
  if (typeof input === "string") return extractFromText(input);

  // Handle array input
  if (Array.isArray(input) && input.length > 0) {
    const lastMsg = input[input.length - 1];
    if (typeof lastMsg === "string") return extractFromText(lastMsg);
    if (typeof lastMsg === "object" && lastMsg && "content" in lastMsg) {
      return extractFromContent((lastMsg as any).content);
    }
  }

  // Handle object with messages property
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

// ============================================================================
// Structured Output Schema
// ============================================================================

export const urlSafetyAnalysisSchema = z.object({
  riskScore: z.number().min(0).max(100),
  categories: z.array(
    z.enum(["phishing", "malware", "scam", "suspicious", "nsfw", "safe"])
  ),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  indicators: z.array(z.string()),
});

// ============================================================================
// Agent Configuration
// ============================================================================

// ============================================================================
// OpenRouter Provider Configuration
// ============================================================================

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * URL Safety Agent
 * Specialized agent for detecting threats in URLs:
 * - Phishing attempts
 * - Malware distribution
 * - Scam patterns
 * - Suspicious redirects
 * - NSFW/adult content
 * - Content safety
 *
 * Uses Grok-4.1-Fast (free tier) via OpenRouter for high-quality analysis with
 * excellent tool use capabilities.
 */
// Create wrapped tools with timing and debugging
const debugContentExtractionTool = wrapToolWithDebugging(
  contentExtractionTool,
  "content-extraction"
);
const debugScreenshotAnalysisTool = wrapToolWithDebugging(
  screenshotAnalysisTool,
  "screenshot-analysis"
);
const debugReputationCheckTool = wrapToolWithDebugging(
  reputationCheckTool,
  "reputation-check"
);

export const urlSafetyAgent = new Agent({
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
    contentExtractionTool: debugContentExtractionTool,
    screenshotAnalysisTool: debugScreenshotAnalysisTool,
    reputationCheckTool: debugReputationCheckTool,
  },
  defaultGenerateOptions: {
    maxSteps: 10, // Allow agent to use tools iteratively
    output: urlSafetyAnalysisSchema,
  },
});

/**
 * Wrapper function for agent.generate() with debugging enabled
 * Use this instead of calling urlSafetyAgent.generate() directly to get debug logs
 * Automatically detects image URLs, takes screenshots pre-model-call, and attaches them to the message
 */
export async function generateWithDebug(
  input: Parameters<typeof urlSafetyAgent.generate>[0],
  options?: Parameters<typeof urlSafetyAgent.generate>[1]
): Promise<ReturnType<typeof urlSafetyAgent.generate>> {
  const startTime = Date.now();

  // Detect image URL
  const detectedUrl = extractUrlFromInput(input);
  const isImage = detectedUrl ? isImageUrl(detectedUrl) : false;

  let enhancedInput = input;

  // Pre-model-call: Take screenshot for image URLs and attach to message using Mastra format
  if (isImage && detectedUrl) {
    debugLog("🖼️ Image URL detected - taking screenshot pre-model-call", {
      url: detectedUrl,
    });

    const screenshotStartTime = Date.now();
    // Use smaller viewport and JPEG format for image URLs to reduce size
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
      const screenshotDuration = Date.now() - screenshotStartTime;
      debugLog("✅ Screenshot captured pre-model-call", {
        duration: `${screenshotDuration}ms`,
      });

      // Attach screenshot to message using Mastra format
      const imageBase64 = screenshotResult.value.screenshotBase64;
      const imageAttachment = {
        type: "image" as const,
        image: imageBase64,
        mimeType: "image/jpeg" as const,
      };

      // Helper to normalize content to array format
      const normalizeContent = (content: any): any[] => {
        if (Array.isArray(content)) return [...content];
        if (typeof content === "string") return [{ type: "text", text: content }];
        return [content];
      };

      // Helper to add image to last message
      const addImageToMessages = (messages: any[]): any[] => {
        const msgs = [...messages];
        const lastMsg = msgs[msgs.length - 1];
        
        if (lastMsg && typeof lastMsg === "object" && "role" in lastMsg && lastMsg.role) {
          const content = normalizeContent((lastMsg as any).content);
          content.push(imageAttachment);
          msgs[msgs.length - 1] = { ...lastMsg, content };
        } else {
          msgs.push({ role: "user", content: [imageAttachment] });
        }
        return msgs;
      };

      if (typeof input === "string") {
        enhancedInput = [{
          role: "user",
          content: [{ type: "text", text: input }, imageAttachment],
        }] as any;
      } else if (Array.isArray(input)) {
        enhancedInput = addImageToMessages(input) as any;
      } else if (typeof input === "object" && input && "messages" in input) {
        enhancedInput = { ...input, messages: addImageToMessages((input as any).messages) } as any;
      }

      debugLog("📎 Screenshot attached to message");
    } else {
      debugLog("⚠️ Screenshot capture failed, proceeding without image", {
        error: screenshotResult.isErr()
          ? screenshotResult.error
          : "No base64 screenshot",
      });
      if (typeof input === "string") {
        enhancedInput =
          `${input}\n\nNote: This is an image URL (${detectedUrl}), but screenshot capture failed. Please analyze the URL metadata.` as any;
      }
    }
  }

  const inputPreview =
    typeof enhancedInput === "string"
      ? enhancedInput
      : typeof enhancedInput === "object" &&
        enhancedInput &&
        "messages" in enhancedInput
      ? `Messages: ${(enhancedInput as any).messages?.length || 0} message(s)`
      : JSON.stringify(enhancedInput).substring(0, 200);

  debugLog("🚀 Agent execution started", {
    input: inputPreview,
    maxSteps: (options as any)?.maxSteps || 10,
    isImageUrl: isImage,
    detectedUrl,
  });

  try {
    // Track steps if possible
    let stepCount = 0;

    // Wrap with step tracking if the agent supports it
    const result = await urlSafetyAgent.generate(enhancedInput, {
      ...options,
      onStepFinish: (step: any) => {
        stepCount++;
        debugLog(`📊 Agent step ${stepCount} completed`, {
          stepType: step?.stepType || "unknown",
          textPreview: step?.text?.substring(0, 100) || "N/A",
        });
        if ((options as any)?.onStepFinish) {
          (options as any).onStepFinish(step);
        }
      },
    } as any);

    const duration = Date.now() - startTime;
    debugLog("✅ Agent execution completed", {
      duration: `${duration}ms`,
      steps: stepCount,
      hasText: !!result.text,
      hasObject: !!(result as any).object,
      isImageUrl: isImage,
      screenshotAttached: isImage,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    debugLog("❌ Agent execution failed", {
      duration: `${duration}ms`,
      // error: error instanceof Error ? error.message : String(error),
      // stack:
      //   error instanceof Error ? error.stack?.substring(0, 500) : undefined,
    });
    throw error;
  }
}
