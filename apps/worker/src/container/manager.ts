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
    const containerConfig: Docker.ContainerCreateOptions = {
      Image: fetcherImage,
      Env: [`JOB_ID=${jobId}`, `URL=${url}`],
      HostConfig: {
        Memory: memoryLimitMB * 1024 * 1024, // Convert MB to bytes
        CpuQuota: Math.floor(cpuLimit * 100000), // CPU quota in microseconds
        CpuPeriod: 100000, // CPU period in microseconds
        AutoRemove: true, // --rm flag
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

    try {
      const waitResult = await Promise.race([waitPromise, timeoutPromise]);
      exitCode = waitResult.StatusCode || 0;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Container execution timeout"
      ) {
        timeoutOccurred = true;
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

    // Get container logs
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      timestamps: false,
    });

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

    // Clean up container (should be auto-removed, but ensure cleanup)
    try {
      await container.remove({ force: true });
    } catch (removeError) {
      // Container might already be removed, ignore error
      console.warn("Container removal warning:", removeError);
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
    let parsedOutput: unknown;
    try {
      // Try to find JSON in stdout (might be mixed with other output)
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return err({
          type: "parse_error",
          message: "No JSON output found in container stdout",
          details: {
            stdout,
            stderr,
          },
        });
      }
      parsedOutput = JSON.parse(jsonMatch[0]);
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

    // Validate output against schema
    const validation = scanResultSchema.safeParse(parsedOutput);
    if (!validation.success) {
      return err({
        type: "validation_error",
        message: "Container output does not match scan result schema",
        details: {
          validationErrors: validation.error.errors,
          stdout,
          stderr,
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
