import { err, ok, Result, wrapDbQuery } from "@safeurl/core/result";
import { validateStateTransition } from "@safeurl/core/schemas";
import { scanJobs } from "@safeurl/db";
import { and, eq } from "drizzle-orm";

import type { Database } from "../lib/db";

/**
 * State transition error types
 */
export interface StateTransitionError {
  type:
    | "invalid_transition"
    | "version_conflict"
    | "not_found"
    | "database_error";
  message: string;
  details?: unknown;
}

/**
 * Transition job from QUEUED to FETCHING
 * Uses optimistic locking with version field
 */
export async function transitionToFetching(
  db: Database,
  jobId: string,
  expectedVersion: number,
): Promise<Result<void, StateTransitionError>> {
  return wrapDbQuery(async () => {
    const [job] = await db
      .select()
      .from(scanJobs)
      .where(eq(scanJobs.id, jobId))
      .limit(1);

    if (!job) {
      return err({
        type: "not_found" as const,
        message: `Scan job ${jobId} not found`,
      });
    }

    // Validate state transition
    const validation = validateStateTransition(job.state, "FETCHING");
    if (!validation.valid) {
      return err({
        type: "invalid_transition" as const,
        message: validation.error || "Invalid state transition",
        details: {
          currentState: job.state,
          targetState: "FETCHING",
        },
      });
    }

    // Check version for optimistic locking
    if (job.version !== expectedVersion) {
      return err({
        type: "version_conflict" as const,
        message: `Version mismatch. Expected: ${expectedVersion}, Actual: ${job.version}`,
        details: {
          expected: expectedVersion,
          actual: job.version,
        },
      });
    }

    // Perform state transition atomically
    await db
      .update(scanJobs)
      .set({
        state: "FETCHING",
        version: job.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(eq(scanJobs.id, jobId), eq(scanJobs.version, expectedVersion)),
      );

    return ok(undefined);
  })
    .mapErr((dbError): StateTransitionError => {
      return {
        type: "database_error" as const,
        message: dbError.message,
        details: dbError,
      };
    })
    .andThen((result) => result);
}

/**
 * Transition job from FETCHING to ANALYZING
 */
export async function transitionToAnalyzing(
  db: Database,
  jobId: string,
  expectedVersion: number,
): Promise<Result<void, StateTransitionError>> {
  return wrapDbQuery(async () => {
    const [job] = await db
      .select()
      .from(scanJobs)
      .where(eq(scanJobs.id, jobId))
      .limit(1);

    if (!job) {
      return err({
        type: "not_found" as const,
        message: `Scan job ${jobId} not found`,
      });
    }

    const validation = validateStateTransition(job.state, "ANALYZING");
    if (!validation.valid) {
      return err({
        type: "invalid_transition" as const,
        message: validation.error || "Invalid state transition",
        details: {
          currentState: job.state,
          targetState: "ANALYZING",
        },
      });
    }

    if (job.version !== expectedVersion) {
      return err({
        type: "version_conflict" as const,
        message: `Version mismatch. Expected: ${expectedVersion}, Actual: ${job.version}`,
        details: {
          expected: expectedVersion,
          actual: job.version,
        },
      });
    }

    await db
      .update(scanJobs)
      .set({
        state: "ANALYZING",
        version: job.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(eq(scanJobs.id, jobId), eq(scanJobs.version, expectedVersion)),
      );

    return ok(undefined);
  })
    .mapErr((dbError): StateTransitionError => {
      return {
        type: "database_error" as const,
        message: dbError.message,
        details: dbError,
      };
    })
    .andThen((result) => result);
}

/**
 * Transition job from ANALYZING to COMPLETED
 */
export async function transitionToCompleted(
  db: Database,
  jobId: string,
  expectedVersion: number,
): Promise<Result<void, StateTransitionError>> {
  return wrapDbQuery(async () => {
    const [job] = await db
      .select()
      .from(scanJobs)
      .where(eq(scanJobs.id, jobId))
      .limit(1);

    if (!job) {
      return err({
        type: "not_found" as const,
        message: `Scan job ${jobId} not found`,
      });
    }

    const validation = validateStateTransition(job.state, "COMPLETED");
    if (!validation.valid) {
      return err({
        type: "invalid_transition" as const,
        message: validation.error || "Invalid state transition",
        details: {
          currentState: job.state,
          targetState: "COMPLETED",
        },
      });
    }

    if (job.version !== expectedVersion) {
      return err({
        type: "version_conflict" as const,
        message: `Version mismatch. Expected: ${expectedVersion}, Actual: ${job.version}`,
        details: {
          expected: expectedVersion,
          actual: job.version,
        },
      });
    }

    await db
      .update(scanJobs)
      .set({
        state: "COMPLETED",
        version: job.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(eq(scanJobs.id, jobId), eq(scanJobs.version, expectedVersion)),
      );

    return ok(undefined);
  })
    .mapErr((dbError): StateTransitionError => {
      return {
        type: "database_error" as const,
        message: dbError.message,
        details: dbError,
      };
    })
    .andThen((result) => result);
}

/**
 * Transition job to FAILED state
 * Can transition from any state to FAILED
 */
export async function transitionToFailed(
  db: Database,
  jobId: string,
  expectedVersion: number,
): Promise<Result<void, StateTransitionError>> {
  return wrapDbQuery(async () => {
    const [job] = await db
      .select()
      .from(scanJobs)
      .where(eq(scanJobs.id, jobId))
      .limit(1);

    if (!job) {
      return err({
        type: "not_found" as const,
        message: `Scan job ${jobId} not found`,
      });
    }

    // FAILED is a terminal state, can transition from any state
    // But we still validate it's not already in a terminal state
    if (
      job.state === "COMPLETED" ||
      job.state === "FAILED" ||
      job.state === "TIMED_OUT"
    ) {
      return err({
        type: "invalid_transition" as const,
        message: `Cannot transition from terminal state ${job.state} to FAILED`,
        details: {
          currentState: job.state,
          targetState: "FAILED",
        },
      });
    }

    if (job.version !== expectedVersion) {
      return err({
        type: "version_conflict" as const,
        message: `Version mismatch. Expected: ${expectedVersion}, Actual: ${job.version}`,
        details: {
          expected: expectedVersion,
          actual: job.version,
        },
      });
    }

    await db
      .update(scanJobs)
      .set({
        state: "FAILED",
        version: job.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(eq(scanJobs.id, jobId), eq(scanJobs.version, expectedVersion)),
      );

    return ok(undefined);
  })
    .mapErr((dbError): StateTransitionError => {
      return {
        type: "database_error" as const,
        message: dbError.message,
        details: dbError,
      };
    })
    .andThen((result) => result);
}

/**
 * Get job by ID with current version
 */
export async function getJobWithVersion(
  db: Database,
  jobId: string,
): Promise<
  Result<
    { job: typeof scanJobs.$inferSelect; version: number },
    StateTransitionError
  >
> {
  return wrapDbQuery(async () => {
    const [job] = await db
      .select()
      .from(scanJobs)
      .where(eq(scanJobs.id, jobId))
      .limit(1);

    if (!job) {
      return err({
        type: "not_found" as const,
        message: `Scan job ${jobId} not found`,
      });
    }

    return ok({ job, version: job.version });
  })
    .mapErr((dbError): StateTransitionError => {
      return {
        type: "database_error" as const,
        message: dbError.message,
        details: dbError,
      };
    })
    .andThen((result) => result);
}
