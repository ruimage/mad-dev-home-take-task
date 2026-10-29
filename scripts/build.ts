import { copyFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import tailwindPlugin from "bun-plugin-tailwind";

/**
 * Production build on pure Bun's bundler with the HTML entrypoint.
 * Tailwind CSS v4 is compiled by the official `bun-plugin-tailwind`.
 */
// Absolute path: `rmSync` with a relative path is a silent no-op on Bun/Windows.
const outdir = resolve("./dist");

// Prevent stale chunks from previous builds.
rmSync(outdir, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir,
  target: "browser",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  // Splits lazy routes (TanStack Router `.lazy()`) into separate chunks.
  splitting: true,
  plugins: [tailwindPlugin],
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

for (const output of result.outputs) {
  console.log(`  ${output.kind.padEnd(8)} ./${output.path}`);
}
copyFileSync(
  new URL("../public/mockServiceWorker.js", import.meta.url),
  resolve(outdir, "mockServiceWorker.js"),
);
console.log("Build succeeded -> ./dist");
