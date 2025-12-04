import {
  createScanRequestSchema,
  createScanResponseSchema,
  errorResponseSchema,
  getScanRequestSchema,
  scanResponseSchema,
} from "@safeurl/core";
import { env } from "cloudflare:workers";

import { getDb } from "../../lib/db";
import type { ScanJobMessage } from "../../lib/queue";
import { privateSubrouter } from "../../plugins";
import { createScanJob, getScanJob } from "./service";

/**
 * Convert database scan job to API response format
 */
function formatScanResponse(job: {
  id: string;
  userId: string;
  url: string;
  state:
    | "QUEUED"
    | "FETCHING"
    | "ANALYZING"
    | "COMPLETED"
    | "FAILED"
    | "TIMED_OUT";
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
export const scansModule = privateSubrouter("/scans")
  .post(
    "/",
    async ({ body, set, userId }) => {
      console.log(`[POST /v1/scans] Request received for userId: ${userId}`);

      const db = getDb(env);
      const queue = env.SCAN_QUEUE as Queue<ScanJobMessage>;

      if (!queue) {
        set.status = 500;
        return {
          error: {
            code: "configuration_error",
            message: "Scan queue not configured",
          },
        };
      }

      const result = await createScanJob(db, queue, userId, body);

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
        description:
          "Creates a new URL scan job and deducts credits from the user's wallet",
        tags: ["Scans"],
        responses: {
          201: {
            description: "Scan job created successfully",
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
      },
      response: {
        201: createScanResponseSchema,
      },
    },
  )
  .get(
    "/:id",
    async ({ params, set, userId }) => {
      console.log(
        `[GET /v1/scans/:id] Request received for id: ${params.id}, userId: ${userId}`,
      );

      const db = getDb(env);
      const result = await getScanJob(db, params.id, userId);

      if (result.isErr()) {
        const error = result.error;

        if (error.code === "not_found") {
          set.status = 404;
        } else {
          set.status = 500;
        }

        return {
          error: {
            code: error.code,
            message: error.message,
            details:
              error.details &&
              typeof error.details === "object" &&
              !Array.isArray(error.details)
                ? (error.details as Record<string, unknown>)
                : undefined,
          },
          timestamp: new Date().toISOString(),
        };
      }

      const job = result.value;
      return formatScanResponse(job);
    },
    {
      params: getScanRequestSchema,
      detail: {
        summary: "Get scan result by job ID",
        description:
          "Retrieves the scan result for a specific job ID. Returns the full result if completed, or status if in progress.",
        tags: ["Scans"],
        responses: {
          200: {
            description: "Scan job retrieved successfully",
          },
          404: {
            description: "Scan job not found",
          },
          500: {
            description: "Server error",
          },
        },
      },
      response: {
        200: scanResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  );
