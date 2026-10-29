import {
  ErrorComponent,
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { HomePage } from "@/pages/home";
import { DisplayPage } from "@/pages/display";
import { Button } from "@/shared/ui";
import { Header } from "@/widgets/header";

function RootLayout() {
  const displayOnly = useRouterState({ select: (state) => state.location.pathname === "/display" });
  if (displayOnly)
    return (
      <main data-display-mode className="h-dvh overflow-hidden">
        <Outlet />
      </main>
    );
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

/** App-level error boundary for unexpected runtime errors. */
function RootError({ error, reset }: ErrorComponentProps) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <ErrorComponent error={error} />
      <Button variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </section>
  );
}

function NotFoundPage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">404 — Page not found</h1>
      <p className="text-sm text-muted-foreground">The page you are looking for does not exist.</p>
      <Button asChild>
        <Link to="/">Go home</Link>
      </Button>
    </section>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const displayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/display",
  component: DisplayPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, displayRoute]),
  defaultPreload: "intent",
});

// Type-safe navigation: registers the router for `Link`/`navigate` typings.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
