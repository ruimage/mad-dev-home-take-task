import { join } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = fileURLToPath(new URL("../dist", import.meta.url));
const port = Number(process.env.PORT ?? 4173);

const server = Bun.serve({
  port,
  async fetch(request) {
    const { pathname } = new URL(request.url);

    // Serve static assets from ./dist as-is.
    if (pathname !== "/") {
      const file = Bun.file(join(distDir, pathname));
      if (await file.exists()) {
        return new Response(file);
      }
    }

    // SPA fallback: unknown routes render the app shell.
    const index = Bun.file(join(distDir, "index.html"));
    if (!(await index.exists())) {
      return new Response("dist/ not found. Run `bun run build` first.", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return new Response(index, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
});

console.log(`Preview server running at ${server.url}`);
