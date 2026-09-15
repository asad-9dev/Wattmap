import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Same precedence as Next.js: values in .env.local win over .env.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  // Only migrate/studio need a connection; generate works from the schema file alone.
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
