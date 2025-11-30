// Configuration schemas and helpers
import { err, ok, Result } from "neverthrow";
import { z } from "zod";

// ============================================================================
// Environment Variable Schemas
// ============================================================================

/**
 * Database configuration schema
 */
export const databaseConfigSchema = z.object({
  url: z.string().url().describe("Database connection URL"),
  authToken: z
    .string()
    .min(1)
    .optional()
    .describe("Database authentication token"),
  maxConnections: z
    .number()
    .int()
    .positive()
    .default(10)
    .describe("Maximum database connections"),
});

/**
 * Redis configuration schema
 */
export const redisConfigSchema = z.object({
  url: z.string().url().describe("Redis connection URL"),
  password: z.string().optional().describe("Redis password (if required)"),
  maxRetriesPerRequest: z
    .number()
    .int()
    .min(0)
    .default(3)
    .describe("Maximum retries per request"),
  enableReadyCheck: z.boolean().default(true).describe("Enable ready check"),
  connectTimeout: z
    .number()
    .int()
    .positive()
    .default(10000)
    .describe("Connection timeout in ms"),
});

/**
 * Clerk configuration schema
 */
export const clerkConfigSchema = z.object({
  secretKey: z.string().min(1).describe("Clerk secret key"),
  publishableKey: z
    .string()
    .min(1)
    .optional()
    .describe("Clerk publishable key"),
  apiUrl: z
    .string()
    .url()
    .optional()
    .describe("Clerk API URL (for custom instances)"),
});

/**
 * LLM provider configuration schema
 */
export const llmProviderConfigSchema = z.object({
  provider: z.enum([
    "openai",
    "anthropic",
    "google",
    "deepseek",
    "kami",
    "ollama",
  ]),
  apiKey: z.string().min(1).describe("API key for the LLM provider"),
  baseUrl: z
    .string()
    .url()
    .optional()
    .describe("Base URL for the API (for custom endpoints)"),
  model: z.string().min(1).describe("Model identifier"),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .default(0.7)
    .describe("Temperature for generation"),
  maxTokens: z
    .number()
    .int()
    .positive()
    .default(4096)
    .describe("Maximum tokens to generate"),
});

/**
 * Complete environment configuration schema
 */
export const envConfigSchema = z.object({
  // Environment
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),

  // Database
  database: databaseConfigSchema,

  // Redis
  redis: redisConfigSchema,

  // Clerk
  clerk: clerkConfigSchema,

  // LLM Provider
  llm: llmProviderConfigSchema,

  // API Configuration
  api: z
    .object({
      port: z.number().int().positive().default(8080),
      host: z.string().default("0.0.0.0"),
      corsOrigin: z
        .string()
        .url()
        .optional()
        .describe("CORS origin (if needed)"),
    })
    .optional(),

  // Worker Configuration
  worker: z
    .object({
      concurrency: z.number().int().positive().default(10),
      maxRetries: z.number().int().min(0).default(3),
    })
    .optional(),
});

// ============================================================================
// Configuration Defaults
// ============================================================================

/**
 * Development defaults
 */
export const developmentDefaults = {
  nodeEnv: "development" as const,
  database: {
    maxConnections: 5,
  },
  redis: {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 10000,
  },
  api: {
    port: 8080,
    host: "0.0.0.0",
  },
  worker: {
    concurrency: 5,
    maxRetries: 3,
  },
};

/**
 * Production defaults
 */
export const productionDefaults = {
  nodeEnv: "production" as const,
  database: {
    maxConnections: 20,
  },
  redis: {
    maxRetriesPerRequest: 5,
    enableReadyCheck: true,
    connectTimeout: 5000,
  },
  api: {
    port: 8080,
    host: "0.0.0.0",
  },
  worker: {
    concurrency: 50,
    maxRetries: 5,
  },
};

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Configuration type
 */
export type EnvConfig = z.infer<typeof envConfigSchema>;

/**
 * Loads and validates environment variables
 *
 * @param env - Environment variables object (defaults to process.env)
 * @returns Result with validated configuration or validation error
 *
 * @example
 * ```typescript
 * const result = loadEnvConfig();
 * result.match(
 *   (config) => console.log("Config loaded:", config),
 *   (error) => console.error("Config error:", error)
 * );
 * ```
 */
export function loadEnvConfig(
  env: Record<string, string | undefined> = process.env,
): Result<EnvConfig, { message: string; errors: z.ZodError }> {
  try {
    // Extract configuration from environment variables
    const nodeEnv =
      (env.NODE_ENV as "development" | "production" | "test") || "development";
    const defaults =
      nodeEnv === "production" ? productionDefaults : developmentDefaults;

    const config: Partial<EnvConfig> = {
      nodeEnv,
      database: {
        url: env.TURSO_CONNECTION_URL || "",
        authToken: env.TURSO_AUTH_TOKEN,
        maxConnections: defaults.database.maxConnections,
      },
      redis: {
        url: env.REDIS_URL || "",
        password: env.REDIS_PASSWORD,
        maxRetriesPerRequest: defaults.redis.maxRetriesPerRequest,
        enableReadyCheck: defaults.redis.enableReadyCheck,
        connectTimeout: defaults.redis.connectTimeout,
      },
      clerk: {
        secretKey: env.CLERK_SECRET_KEY || "",
        publishableKey: env.CLERK_PUBLISHABLE_KEY,
        apiUrl: env.CLERK_API_URL,
      },
      llm: {
        provider:
          (env.LLM_PROVIDER as EnvConfig["llm"]["provider"]) || "openai",
        apiKey: env.LLM_API_KEY || "",
        baseUrl: env.LLM_BASE_URL,
        model: env.LLM_MODEL || "gpt-4",
        temperature: env.LLM_TEMPERATURE
          ? parseFloat(env.LLM_TEMPERATURE)
          : 0.7,
        maxTokens: env.LLM_MAX_TOKENS ? parseInt(env.LLM_MAX_TOKENS, 10) : 4096,
      },
      api: {
        port: env.API_PORT ? parseInt(env.API_PORT, 10) : defaults.api.port,
        host: env.API_HOST || defaults.api.host,
        corsOrigin: env.CORS_ORIGIN,
      },
      worker: {
        concurrency: env.WORKER_CONCURRENCY
          ? parseInt(env.WORKER_CONCURRENCY, 10)
          : defaults.worker.concurrency,
        maxRetries: env.WORKER_MAX_RETRIES
          ? parseInt(env.WORKER_MAX_RETRIES, 10)
          : defaults.worker.maxRetries,
      },
    };

    // Validate configuration
    const result = envConfigSchema.safeParse(config);
    if (!result.success) {
      return err({
        message: "Configuration validation failed",
        errors: result.error,
      });
    }

    return ok(result.data);
  } catch (error) {
    return err({
      message:
        error instanceof Error ? error.message : "Failed to load configuration",
      errors: error instanceof z.ZodError ? error : new z.ZodError([]),
    });
  }
}

/**
 * Provides helpful error messages for missing environment variables
 *
 * @param errors - Zod validation errors
 * @returns Array of helpful error messages
 */
export function getConfigErrorMessages(errors: z.ZodError): string[] {
  const messages: string[] = [];

  for (const issue of errors.issues) {
    const path = issue.path.join(".");
    if (issue.code === "invalid_type" && issue.received === "undefined") {
      messages.push(
        `Missing required environment variable: ${getEnvVarName(path)}`,
      );
    } else {
      messages.push(`${path}: ${issue.message}`);
    }
  }

  return messages;
}

/**
 * Maps configuration path to environment variable name
 */
function getEnvVarName(path: string): string {
  const mapping: Record<string, string> = {
    "database.url": "TURSO_CONNECTION_URL",
    "database.authToken": "TURSO_AUTH_TOKEN",
    "redis.url": "REDIS_URL",
    "redis.password": "REDIS_PASSWORD",
    "clerk.secretKey": "CLERK_SECRET_KEY",
    "clerk.publishableKey": "CLERK_PUBLISHABLE_KEY",
    "clerk.apiUrl": "CLERK_API_URL",
    "llm.provider": "LLM_PROVIDER",
    "llm.apiKey": "LLM_API_KEY",
    "llm.baseUrl": "LLM_BASE_URL",
    "llm.model": "LLM_MODEL",
    "llm.temperature": "LLM_TEMPERATURE",
    "llm.maxTokens": "LLM_MAX_TOKENS",
    "api.port": "API_PORT",
    "api.host": "API_HOST",
    "api.corsOrigin": "CORS_ORIGIN",
    "worker.concurrency": "WORKER_CONCURRENCY",
    "worker.maxRetries": "WORKER_MAX_RETRIES",
  };

  return mapping[path] || path.toUpperCase().replace(/\./g, "_");
}
