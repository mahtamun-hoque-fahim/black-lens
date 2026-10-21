import { defineConfig } from "drizzle-kit"

// Only used to generate db/schema.sql (no database connection needed): npx drizzle-kit generate
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
})
