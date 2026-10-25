import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    // Four suites start a real Postgres engine (PGlite) and hash passwords; run together on a busy
    // machine, that setup can pass the 10 second default and fail a test that is correct.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
})
