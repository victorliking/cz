import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

/**
 * Vitest configuration for HomeMatch.
 *
 * - node environment (these are pure-function unit tests: no DOM, no DB, no network)
 * - mirrors the "@/..." path alias from tsconfig.json ("@/*": ["./*"]) so imports
 *   like "@/lib/scoring/match-engine" resolve the same way they do in the Next.js app.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["lib/**/*.test.ts"],
  },
})
