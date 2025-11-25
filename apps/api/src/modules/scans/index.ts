import { Elysia } from "elysia";
import { createScanRequestSchema, getScanRequestSchema, scanResponseSchema } from "./schemas";
import { createScanJob, getScanJob } from "./service";
import { authPlugin } from "../../plugins/auth";

/**
 * Convert database scan job to API response format
 */
function formatScanResponse(job: {
  id: string;
  userId: string;
  url: string;
  state: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  result?: {
    riskScore: number;
    categories: string[];
    reasoning: string;
    indicators: string[];
    contentHash: string;
    httpStatus: number | null;
    httpHeaders: Record<string, string> | null;
    contentType: string | null;
    modelUsed: string;
    analysisMetadata: Record<string, unknown> | null;
  } | null;
}) {
  return {
    id: job.id,
    url: job.url,
    state: job.state,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    result: job.result
      ? {
          riskScore: job.result.riskScore,
          categories: job.result.categories,
          confidenceScore: 0.8, // Default confidence score (not stored in DB)
          reasoning: job.result.reasoning,
          indicators: job.result.indicators,
          contentHash: job.result.contentHash,
          httpStatus: job.result.httpStatus,
          httpHeaders: job.result.httpHeaders || {},
          contentType: job.result.contentType,
          modelUsed: job.result.modelUsed,
          analysisMetadata: job.result.analysisMetadata || {},
        }
      : null,
  };
}

/**
 * Scans module routes
 */
export const scansModule = new Elysia({ prefix: "/scans" })
  .use(authPlugin)
  .post(
    "/",
    async ({ body, user, set }) => {
      const result = await createScanJob(user.clerkUserId, body);

      if (result.isErr()) {
        const error = result.error;
        
        // Map error codes to HTTP status codes
        if (error.code === "insufficient_credits") {
          set.status = 402;
        } else if (error.code === "validation_error") {
          set.status = 400;
        } else {
          set.status = 500;
        }

        return {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        };
      }

      const job = result.value;
      set.status = 201;
      return {
        id: job.id,
        state: job.state,
      };
    },
    {
      body: createScanRequestSchema,
      detail: {
        summary: "Create a new URL scan job",
        description: "Creates a new URL scan job and deducts credits from the user's wallet",
        tags: ["Scans"],
        security: [{ BearerAuth: [] }],
      },
      response: {
        201: {
          description: "Scan job created successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  state: { type: "string", enum: ["QUEUED"] },
                },
                required: ["id", "state"],
              },
            },
          },
        },
        400: {
          description: "Validation error",
        },
        402: {
          description: "Insufficient credits",
        },
        500: {
          description: "Server error",
        },
      },
    }
  )
  .get(
    "/:id",
    async ({ params, user, set }) => {
      const result = await getScanJob(params.id, user.clerkUserId);

      if (result.isErr()) {
        const error = result.error;
        
        if (error.code === "not_found") {
          set.status = 404;
        } else if (error.code === "authorization_error") {
          set.status = 403;
        } else {
          set.status = 500;
        }

        return {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        };
      }

      const job = result.value;
      return formatScanResponse(job);
    },
    {
      params: getScanRequestSchema,
      detail: {
        summary: "Get scan result by job ID",
        description: "Retrieves the scan result for a specific job ID. Returns the full result if completed, or status if in progress.",
        tags: ["Scans"],
        security: [{ BearerAuth: [] }],
      },
      response: {
        200: {
          description: "Scan job retrieved successfully",
          content: {
            "application/json": {
              schema: scanResponseSchema,
            },
          },
        },
        403: {
          description: "Not authorized to access this scan job",
        },
        404: {
          description: "Scan job not found",
        },
        500: {
          description: "Server error",
        },
      },
    }
  );

