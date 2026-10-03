import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migration/legacy/sqlite",
  schema: "./db/schema.ts",
  dialect: "sqlite",
});
