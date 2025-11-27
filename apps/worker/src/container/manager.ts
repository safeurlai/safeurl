import Docker from "dockerode";
import { Result, ok, err } from "@safeurl/core/result";
import { docker } from "../lib/docker";
import { scanResultSchema, type ScanResult } from "@safeurl/core/schemas";

/**
 * Container execution error types
 */
export interface ContainerError {
  type:
    | "timeout"
    | "crash"
    | "parse_error"
    | "validation_error"
    | "docker_error";
  message: string;
  details?: unknown;
}

/**
 * Container execution result
 */
export interface ContainerExecutionResult {
  result: ScanResult;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Spawn an ephemeral fetcher container and execute it
 *
 * @param jobId - Scan job ID
 * @param url - URL to fetch
 * @returns Result with scan result or error
 */
export async function spawnFetcherContainer(
  jobId: string,
  url: string
): Promise<Result<ContainerExecutionResult, ContainerError>> {
  const fetcherImage = process.env.FETCHER_IMAGE || "safeurl-fetcher:latest";
  const timeoutMs = parseInt(process.env.CONTAINER_TIMEOUT_MS || "30000", 10);
  const memoryLimitMB = parseInt(
    process.env.CONTAINER_MEMORY_LIMIT_MB || "512",
    10
  );
  const cpuLimit = parseFloat(process.env.CONTAINER_CPU_LIMIT || "0.5");

  try {
    // Pull image if needed (or ensure it exists)
    try {
      await docker.getImage(fetcherImage).inspect();
    } catch (error) {
      // Image doesn't exist locally, try to pull it
      console.log(`Pulling fetcher image: ${fetcherImage}`);
      await new Promise<void>((resolve, reject) => {
        docker.pull(fetcherImage, (err: Error | null, stream: any) => {
          if (err) {
            reject(err);
            return;
          }
          docker.modem.followProgress(stream, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
    }

    // Create container configuration
    // Note: AutoRemove is disabled to prevent race condition when retrieving logs
    // We manually remove the container after getting logs
    const containerEnv = [`JOB_ID=${jobId}`, `SCAN_URL=${url}`];

    // Add OPENROUTER_API_KEY if available (required for Mastra agent)
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (openRouterApiKey) {
      containerEnv.push(`OPENROUTER_API_KEY=${openRouterApiKey}`);
    } else {
      const errorMsg =
        "OPENROUTER_API_KEY environment variable is not set. " +
        "This is required for Mastra agent execution. " +
        "Get your API key from https://openrouter.ai/keys and set it in your environment or .env file before running tests or the worker.";
      console.error(`[CONTAINER ERROR] ${errorMsg}`);
      // Don't fail here - let the container fail with a clear error message
      // This allows tests to run and fail gracefully
    }

    const containerConfig: Docker.ContainerCreateOptions = {
      Image: fetcherImage,
      Env: containerEnv,
      HostConfig: {
        Memory: memoryLimitMB * 1024 * 1024, // Convert MB to bytes
        CpuQuota: Math.floor(cpuLimit * 100000), // CPU quota in microseconds
        CpuPeriod: 100000, // CPU period in microseconds
        AutoRemove: false, // Disabled to prevent race condition - we remove manually after getting logs
        NetworkMode: "bridge", // Network isolation
      },
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    };

    // Create container
    const container = await docker.createContainer(containerConfig);

    // Start container
    await container.start();

    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Container execution timeout"));
      }, timeoutMs);
    });

    // Wait for container to finish
    const waitPromise = container.wait();

    let exitCode = 0;
    let timeoutOccurred = false;
    let logs: any = null;

    try {
      const waitResult = await Promise.race([waitPromise, timeoutPromise]);
      exitCode = waitResult.StatusCode || 0;

      // Get logs immediately after container exits (before AutoRemove kicks in)
      try {
        logs = await container.logs({
          stdout: true,
          stderr: true,
          timestamps: false,
        });
      } catch (logError: any) {
        // If we can't get logs (container already removed), log warning but continue
        const errorMsg = logError?.message?.toLowerCase() || "";
        if (
          errorMsg.includes("dead") ||
          errorMsg.includes("removed") ||
          errorMsg.includes("409")
        ) {
          console.warn(
            "Could not retrieve logs: container was already removed"
          );
          logs = Buffer.from(""); // Use empty buffer as fallback
        } else {
          throw logError;
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Container execution timeout"
      ) {
        timeoutOccurred = true;

        // Try to get logs before killing the container
        try {
          logs = await container.logs({
            stdout: true,
            stderr: true,
            timestamps: false,
          });
        } catch (logError: any) {
          const errorMsg = logError?.message?.toLowerCase() || "";
          if (
            errorMsg.includes("dead") ||
            errorMsg.includes("removed") ||
            errorMsg.includes("409")
          ) {
            console.warn(
              "Could not retrieve logs before timeout kill: container was already removed"
            );
            logs = Buffer.from("");
          } else {
            // If we can't get logs, continue anyway
            logs = Buffer.from("");
          }
        }

        // Kill the container
        try {
          await container.kill();
        } catch (killError) {
          console.error("Failed to kill timed-out container:", killError);
        }
      } else {
        throw error;
      }
    }

    // Ensure we have logs buffer
    if (!logs) {
      logs = Buffer.from("");
    }

    const logBuffer = Buffer.isBuffer(logs) ? logs : Buffer.from(logs);

    // Docker log format: 8-byte header [stream type (1 byte)][padding (3 bytes)][size (4 bytes)]
    // Stream type: 1 = stdout, 2 = stderr
    let stdout = "";
    let stderr = "";
    let offset = 0;

    // Check if this is Docker log format (starts with stream type byte)
    if (logBuffer.length > 0 && (logBuffer[0] === 1 || logBuffer[0] === 2)) {
      // Parse Docker log format
      while (offset < logBuffer.length) {
        if (offset + 8 > logBuffer.length) break;

        const streamType = logBuffer[offset];
        const size = logBuffer.readUInt32BE(offset + 4);

        if (offset + 8 + size > logBuffer.length) break;

        const content = logBuffer
          .slice(offset + 8, offset + 8 + size)
          .toString("utf-8");

        if (streamType === 1) {
          stdout += content;
        } else if (streamType === 2) {
          stderr += content;
        }

        offset += 8 + size;
      }
    } else {
      // Plain text format (fallback)
      stdout = logBuffer.toString("utf-8");
    }

    // Clean up container (manual removal since AutoRemove is disabled)
    try {
      await container.remove({ force: true });
    } catch (removeError: any) {
      // Container might already be removed, ignore error
      const errorMsg = removeError?.message?.toLowerCase() || "";
      if (!errorMsg.includes("no such container")) {
        console.warn("Container removal warning:", removeError);
      }
    }

    // Handle timeout
    if (timeoutOccurred) {
      return err({
        type: "timeout",
        message: `Container execution exceeded timeout of ${timeoutMs}ms`,
        details: {
          timeoutMs,
          stdout,
          stderr,
        },
      });
    }

    // Handle non-zero exit code
    if (exitCode !== 0) {
      return err({
        type: "crash",
        message: `Container exited with code ${exitCode}`,
        details: {
          exitCode,
          stdout,
          stderr,
        },
      });
    }

    // Parse JSON output from stdout
    // The fetcher outputs a wrapper: {"jobId":"...","success":true,"result":{...}}
    // We need to extract the "result" field for validation
    let parsedOutput: unknown;
    let resultData: unknown;

    try {
      // Try to find JSON in stdout (might be mixed with other output like warnings)
      // Look for the last JSON object (in case there are multiple or warnings before)
      const jsonMatches = stdout.match(/\{[\s\S]*\}/g);
      if (!jsonMatches || jsonMatches.length === 0) {
        return err({
          type: "parse_error",
          message: "No JSON output found in container stdout",
          details: {
            stdout,
            stderr,
          },
        });
      }

      // Parse the last JSON object (should be the main output)
      parsedOutput = JSON.parse(jsonMatches[jsonMatches.length - 1]);

      // Check if this is a wrapper object with success/result fields
      if (
        typeof parsedOutput === "object" &&
        parsedOutput !== null &&
        "success" in parsedOutput &&
        "result" in parsedOutput
      ) {
        const wrapper = parsedOutput as {
          success: boolean;
          result: unknown;
          jobId?: string;
        };

        // Check if the operation was successful
        if (!wrapper.success) {
          return err({
            type: "crash",
            message:
              wrapper.result &&
              typeof wrapper.result === "object" &&
              "error" in wrapper.result
                ? `Container reported failure: ${JSON.stringify(
                    wrapper.result
                  )}`
                : "Container reported failure",
            details: {
              stdout,
              stderr,
              wrapper,
            },
          });
        }

        // Extract the result field for validation
        resultData = wrapper.result;
      } else {
        // Assume it's already the result object (backward compatibility)
        resultData = parsedOutput;
      }
    } catch (parseError) {
      return err({
        type: "parse_error",
        message: "Failed to parse JSON output from container",
        details: {
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
          stdout,
          stderr,
        },
      });
    }

    // Validate the result against schema
    const validation = scanResultSchema.safeParse(resultData);
    if (!validation.success) {
      return err({
        type: "validation_error",
        message: "Container output does not match scan result schema",
        details: {
          validationErrors: validation.error.errors,
          stdout,
          stderr,
          parsedOutput,
        },
      });
    }

    return ok({
      result: validation.data,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode,
    });
  } catch (error) {
    return err({
      type: "docker_error",
      message:
        error instanceof Error ? error.message : "Docker operation failed",
      details: error,
    });
  }
}
