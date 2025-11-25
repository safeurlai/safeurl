import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * OpenAPI plugin configuration
 * Sets up Swagger UI and OpenAPI documentation
 */
export const openApiPlugin = new Elysia().use(
  openapi({
    schema: {
      openapi: "3.0.0",
      info: {
        title: "SafeURL.ai API",
        version: "1.0.0",
        description: "AI-powered URL safety screening service",
        contact: {
          name: "SafeURL.ai Support",
        },
      },
      servers: [
        {
          url: process.env.API_BASE_URL || "http://localhost:8080",
          description: "API Server",
        },
      ],
      tags: [
        {
          name: "Scans",
          description: "URL scan operations",
        },
        {
          name: "Credits",
          description: "Credit balance and purchase operations",
        },
        {
          name: "Webhooks",
          description: "Webhook management",
        },
        {
          name: "System",
          description: "System health and status",
        },
      ],
      components: {},
    },
    // Configure Zod to JSON Schema mapper for Zod v3
    mapJsonSchema: {
      zod: zodToJsonSchema,
    },
    // Customize Swagger UI path
    swagger: {
      path: "/openapi",
      autoDarkMode: true,
    },
    // Customize OpenAPI JSON path
    jsonPath: "/openapi/json",
  })
);

