import { defineConfig } from "@playwright/experimental-ct-react";
import { fileURLToPath } from "node:url";

/**
 * Component tests: `*.ct.tsx` specs are bundled by Playwright's
 * internal vite pipeline; the "@" alias mirrors tsconfig paths.
 */
export default defineConfig({
  testDir: "./src",
  testMatch: "**/*.ct.tsx",
  use: {
    trace: "on-first-retry",
    ctViteConfig: {
      resolve: {
        alias: {
          "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
      },
    },
  },
});
