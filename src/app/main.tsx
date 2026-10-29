import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { AppProviders } from "./providers";
import { router } from "./router";
import { startMockApi } from "./mocks/browser";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

const root = createRoot(rootElement);
const devTools =
  process.env.NODE_ENV === "development"
    ? import("./devtools/state-inspector").then(({ mountStateInspector }) => mountStateInspector())
    : Promise.resolve();
Promise.all([startMockApi(), devTools])
  .then(() =>
    root.render(
      <StrictMode>
        <AppProviders>
          <RouterProvider router={router} />
        </AppProviders>
      </StrictMode>,
    ),
  )
  .catch(() =>
    root.render(
      <main className="mx-auto max-w-xl p-8" role="alert">
        <h1 className="text-xl font-semibold">Не удалось запустить приложение</h1>
        <p className="my-4">Проверьте доступность mock API и перезагрузите страницу.</p>
        <button type="button" className="underline" onClick={() => location.reload()}>
          Повторить запуск
        </button>
      </main>,
    ),
  );
