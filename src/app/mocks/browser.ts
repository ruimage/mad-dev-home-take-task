import { setupWorker } from "msw/browser";
import { createHandlers } from "./handlers";

const worker = setupWorker(...createHandlers());
export function startMockApi() {
  return worker.start({
    quiet: true,
    onUnhandledRequest: "bypass",
    serviceWorker: { url: "/mockServiceWorker.js" },
  });
}
