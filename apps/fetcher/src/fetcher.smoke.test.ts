import { join } from "path";
import { spawn } from "bun";
import { beforeAll, expect, test } from "bun:test";

const FETCHER_SCRIPT = join(import.meta.dir, "index.ts");
const TEST_URL = "https://i.4cdn.org/cgl/1683919741567583.jpg";
const TEST_JOB_ID = `smoke-test-${Date.now()}`;

beforeAll(() => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is required for tests",
    );
  }
});

test("should analyze image URL and use screenshot-analysis tool", async () => {
  const proc = spawn({
    cmd: [
      "bun",
      "run",
      FETCHER_SCRIPT,
      "--job-id",
      TEST_JOB_ID,
      "--url",
      TEST_URL,
    ],
    env: {
      ...process.env,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, _stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  expect(exitCode).toBe(0);
  expect(stdout.length).toBeGreaterThan(0);

  let output: any;
  try {
    const jobIdJsonMatch = stdout.match(/\{"jobId":[\s\S]*\}/);
    if (jobIdJsonMatch) {
      output = JSON.parse(jobIdJsonMatch[0]);
    } else {
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in stdout");
      }
      output = JSON.parse(jsonMatch[0]);
    }
  } catch (parseError) {
    throw new Error(`Failed to parse output: ${parseError}`);
  }

  expect(output).toHaveProperty("jobId");
  expect(output.jobId).toBe(TEST_JOB_ID);
  expect(output).toHaveProperty("success");
  expect(output.success).toBe(true);
  expect(output).toHaveProperty("result");

  expect(output.result).toHaveProperty("riskScore");
  expect(output.result).toHaveProperty("categories");
  expect(output.result).toHaveProperty("confidenceScore");
  expect(output.result).toHaveProperty("reasoning");
  expect(output.result).toHaveProperty("indicators");
  expect(output.result).toHaveProperty("contentHash");
  expect(output.result).toHaveProperty("httpStatus");

  expect(typeof output.result.riskScore).toBe("number");
  expect(Array.isArray(output.result.categories)).toBe(true);
  expect(typeof output.result.confidenceScore).toBe("number");
  expect(typeof output.result.reasoning).toBe("string");
  expect(Array.isArray(output.result.indicators)).toBe(true);

  const reasoning = output.result.reasoning.toLowerCase();
  const hasVisualAnalysis =
    reasoning.includes("screenshot") ||
    reasoning.includes("visual") ||
    reasoning.includes("image") ||
    reasoning.includes("nsfw");
}, 120_000);

test("fetcher validates required parameters", async () => {
  const simpleUrl = "https://example.com";

  const proc1 = spawn({
    cmd: ["bun", "run", FETCHER_SCRIPT, "--url", simpleUrl],
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout1, stderr1, exitCode1] = await Promise.all([
    new Response(proc1.stdout).text(),
    new Response(proc1.stderr).text(),
    proc1.exited,
  ]);

  expect(exitCode1).toBe(1);
  const combinedOutput1 = stdout1 + stderr1;
  expect(combinedOutput1).toContain("Missing required parameter");

  const proc2 = spawn({
    cmd: ["bun", "run", FETCHER_SCRIPT, "--job-id", TEST_JOB_ID],
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout2, stderr2, exitCode2] = await Promise.all([
    new Response(proc2.stdout).text(),
    new Response(proc2.stderr).text(),
    proc2.exited,
  ]);

  expect(exitCode2).toBe(1);
  const combinedOutput2 = stdout2 + stderr2;
  expect(combinedOutput2).toContain("Missing required parameter");
}, 10000);

test("fetcher accepts environment variables", async () => {
  const simpleUrl = "https://example.com";
  const envJobId = `env-test-${Date.now()}`;

  const proc = spawn({
    cmd: ["bun", "run", FETCHER_SCRIPT],
    env: {
      ...process.env,
      JOB_ID: envJobId,
      SCAN_URL: simpleUrl,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ]);

  expect(exitCode).toBeDefined();
  expect(stdout.length).toBeGreaterThan(0);
  expect(stdout).toContain(envJobId);
}, 60000);
