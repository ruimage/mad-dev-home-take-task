import app from "../index.html";

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/mockServiceWorker.js": () =>
      new Response(Bun.file(new URL("../public/mockServiceWorker.js", import.meta.url)), {
        headers: { "content-type": "text/javascript" },
      }),
    "/*": app,
  },
  development: { hmr: true, console: true },
});
console.log(`Dev server: ${server.url}`);
