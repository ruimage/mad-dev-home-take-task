# bun-fsd-template

Frontend template on **pure Bun**: dev server, bundler and unit tests without Vite/Webpack/esbuild.
Architecture follows **Feature-Sliced Design**, the UI is built with **shadcn/ui + Tailwind CSS v4**,
external sources are isolated in a **service layer wired through DI**, queries run through a
**Proxy-based query layer**, and domain values are protected with **Zod + @rzv/make-brand branded
types**. Routing is **TanStack Router** (code-based, type-safe, code-split). Data pipelines use
**Remeda**, error/absence modelling uses **Effect** monads (`Result`, `Option`). Unit tests mock the
network with **MSW**. Linting & formatting: **oxlint + oxfmt**.

## Usage with degit

```bash
bunx degit <your-github-user>/bun-fsd-template my-app
cd my-app
bun install
bun run dev
```

> Requires Bun >= 1.3 (HTML-entrypoint dev server & bundler).

## Scripts

| Script                  | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `bun run dev`           | Dev server on `bun ./index.html` (HMR, Tailwind compiled) |
| `bun run build`         | Production build via `Bun.build` → `./dist`               |
| `bun run preview`       | Static preview of `./dist` with SPA fallback (port 4173)  |
| `bun run test:unit`     | Unit tests with `bun test` (`*.test.ts`)                  |
| `bun run test:coverage` | Unit tests with coverage report (`bun test --coverage`)   |
| `bun run test:e2e`      | Playwright e2e tests (`e2e/*.e2e.ts`)                     |
| `bun run test:ct`       | Playwright component tests (`src/**/*.ct.tsx`)            |
| `bun run typecheck`     | `tsc --noEmit`                                            |
| `bun run lint`          | oxlint                                                    |
| `bun run format`        | oxfmt (in place)                                          |
| `bun run format:check`  | oxfmt `--check`                                           |
| `bun run check`         | typecheck + lint + format check + unit tests              |

After cloning, install Playwright browsers once:

```bash
bunx playwright install chromium
```

## Stack

- **Bun** — runtime, dev server (`bun ./index.html`), bundler (`Bun.build`), test runner (`bun test`)
- **TypeScript** (strict) with `@/*` path aliases resolved by Bun's bundler and `tsc`
- **Tailwind CSS v4** compiled by the official [`bun-plugin-tailwind`](https://bun.com/docs/bundler/html-static) (wired in `bunfig.toml` for dev and in `scripts/build.ts` for builds); dark mode included
- **shadcn/ui** (new-york, neutral) with components placed in the FSD `shared/ui` layer
- **TanStack Router** — code-based routes, type-safe `Link`, lazy code-split routes, 404 & error components (pinned to `1.169.2`: `1.170.x` breaks Bun's dev server due to a circular-import evaluation order bug in `router-core`; production builds are unaffected)
- **Zod v4 + [@rzv/make-brand](https://github.com/ruimage/make-brand)** — validated branded types
- **Remeda** — data-first/data-last pipelines (`pipe`, `filter`, `sortBy`, …) in features and pages
- **Effect monads** — `Result` (v4 successor of `Either`) for explicit error channels, `Option` for absent values
- **Playwright** — e2e + component tests; **MSW** — network-level mocks for unit tests
- **oxlint / oxfmt** — linting and formatting

## Feature-Sliced Design

```
src/
├── app/       # composition root: entry, providers (DI + queries), router, global styles
├── pages/     # routes composed of widgets/features/entities (+ *.lazy.tsx code-split files)
├── widgets/   # composite layout blocks (header, sidebars…)
├── features/  # user interactions — one folder per feature slice
├── entities/  # domain models — model / api / ui segments per slice
└── shared/    # reusable, domain-agnostic code:
    ├── api/       # transport (HttpClient) + transport token — the service layer base
    ├── lib/       # DI container, query layer (QueryStore + Proxy), helpers
    └── ui/        # shadcn/ui components, theme toggle, cn
```

Recommended layering rules (conventions — enforced by code review; add a checker such as
`@fsdify/eslint-plugin` if you want automation):

1. Every module lives in one of the six FSD layers.
2. A layer imports only from layers **strictly below** it
   (`app → pages → widgets → features → entities → shared`).
3. The `app` layer is not importable by anyone.
4. Slices of `entities/features/widgets/pages` never cross-import within the same layer.
5. Relative imports never escape their own slice.

Conventions kept by discipline: import slices through their `index.ts` public API.

## Service layer, DI & the query proxy

External sources are isolated behind services resolved through a tiny typed DI container
(`src/shared/lib/di`, zero dependencies). On top of it, `src/shared/lib/query` implements the
query mechanism with a `Proxy`:

```ts
// 1. A transport contract + token (shared/api)
export interface HttpClient {
  get<T>(path: string, schema: z.ZodType<T>): Promise<T>;
}
export const HTTP_CLIENT = createToken<HttpClient>("shared.api.http-client");

// 2. A domain service depends on the contract only (e.g. entities/<slice>/api)
export class MyService {
  constructor(httpClient: HttpClient) {
    /* … */
  }
  getAll(): Promise<MyEntity[]> {
    /* validates responses with Zod */
  }
}
export const MY_SERVICE = createToken<MyService>("entities.<slice>.my-service");

// 3. The app layer wires implementations once (app/providers/di.tsx):
//    services are wrapped in a tracking Proxy — every method call updates the QueryStore.
container.register(
  HTTP_CLIENT,
  new FetchHttpClient({ baseUrl: "https://jsonplaceholder.typicode.com" }),
);
container.register(
  MY_SERVICE,
  trackQueries(new MyService(container.resolve(HTTP_CLIENT)), queryStore, MY_SERVICE.name),
);

// 4. Feature code consumes queries via a single hook
const { status, data, error, refetch } = useServiceQuery(MY_SERVICE, "getAll");
```

The `QueryStore` is framework-free (fully unit-tested): it tracks `pending → success/error`
per `<token>.<method>` key, deduplicates concurrent in-flight requests, and notifies subscribers.
`useServiceQuery` subscribes through `useSyncExternalStore` and refetches on mount. Swapping the
transport (mock server, other API, offline fake) touches only the provider file.

## Branded types

`@rzv/make-brand` turns a Zod schema into a nominal-type toolkit:

```ts
export const UserIdBrand = makeBrand(z.number().int().positive(), "UserId");
export type UserId = z.infer<typeof UserIdBrand.schema>;

const id = UserIdBrand.create(1); // branded number
UserIdBrand.matches(1); // runtime guard
UserIdBrand.toPrimitive(id); // back to plain number
```

`UserId` stays a plain `number` at runtime but cannot be mixed with other branded ids in TypeScript.

## Effect monads

Effect v4 replaces `Either` with **`Result`** and pairs it with **`Option`**:

```ts
// shared/api/result.ts — explicit error channel for requests
const result = await tryRequest(() => httpClient.get("/resource", schema)); // Result<T, ApiError>
Result.match(result, {
  onFailure: (error) => setError(error.message),
  onSuccess: (data) => setData(data),
});

// Absence modelling with Option
const found: Option.Option<Item> = Option.fromNullishOr(items.find(matches));
```

Throwing methods stay available for the query proxy; `tryRequest` (unit-tested in `shared/api/result.test.ts`) returns a monad for callers that prefer compositional error handling.

## Testing conventions

| Kind      | Runner                | Location / pattern    | Example                                  |
| --------- | --------------------- | --------------------- | ---------------------------------------- |
| Unit      | `bun test` (+ MSW)    | colocated `*.test.ts` | `src/shared/api/http-client.test.ts`     |
| E2E       | Playwright            | `e2e/*.e2e.ts`        | `e2e/home.e2e.ts`                        |
| Component | Playwright CT (React) | colocated `*.ct.tsx`  | `src/shared/ui/components/button.ct.tsx` |

File naming keeps the three suites independent: `bun test` collects only `*.test.*`,
Playwright configs pin their own `testMatch`. The CT harness template lives in
`playwright/index.html` + `playwright/index.ts` (Playwright injects its mount runtime there).

**MSW (v2, pinned):** unit tests run the real `FetchHttpClient` against network-level mocks
(`setupServer` from `msw/node`), with `onUnhandledRequest: "error"` so unexpected requests fail
loudly — see `src/shared/api/http-client.test.ts` for the handler pattern. MSW v3 (3.0.x) is pinned
out: its interceptor stack currently fails to resolve handlers under the Bun runtime (`fetch` is
patched, but requests bypass silently). E2E specs stay on Playwright-native `page.route`, which
mocks at the browser level and needs no app-side worker.

Coverage: `bun run test:coverage` prints a per-file report (Bun's built-in `--coverage`).

> Note: `FetchHttpClient` binds `fetch` to `globalThis` — a detached `fetch` reference throws
> `Illegal invocation` in browsers. Keep this in mind when adding transports.

## shadcn/ui

`components.json` maps aliases into the FSD `shared` layer, so the CLI drops new components
exactly where the architecture expects them:

```bash
bunx --bun shadcn@latest add dialog
# → src/shared/ui/components/dialog.tsx
```

Theme tokens live in `src/app/styles/global.css` (Tailwind v4 `@theme inline`, `neutral` base,
dark mode via the `.dark` class). The dark-mode toggle (`shared/ui/theme`) persists to
localStorage and is applied before first paint by an inline script in `index.html`.

## CI

`.github/workflows/ci.yml` runs the full pipeline on GitHub Actions: install → check
(typecheck, oxlint, oxfmt, unit tests) → build → e2e → component tests.
