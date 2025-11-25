import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "libsql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "file:./local.db",
  },
});

