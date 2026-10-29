import { useMemo, type ReactNode } from "react";
import { FetchHttpClient, HTTP_CLIENT } from "@/shared/api";
import { ContainerProvider, ServiceContainer } from "@/shared/lib/di";
import { QueryStore, QueryStoreProvider } from "@/shared/lib/query";

/**
 * Composition root of the app: every external source is wired here.
 * Swap `FetchHttpClient` for another `HttpClient` implementation
 * (mock transport, different base url) in one place.
 */
const API_BASE_URL = "https://jsonplaceholder.typicode.com";

interface AppServices {
  container: ServiceContainer;
  queryStore: QueryStore;
}

function createAppServices(): AppServices {
  const container = new ServiceContainer();
  const queryStore = new QueryStore();

  const httpClient = new FetchHttpClient({ baseUrl: API_BASE_URL });
  container.register(HTTP_CLIENT, httpClient);
  // Register domain services wrapped in the query-tracking proxy, e.g.:
  //   container.register(
  //     MY_SERVICE,
  //     trackQueries(new MyService(httpClient), queryStore, MY_SERVICE.name),
  //   );
  // Consumers then read them through `useServiceQuery(MY_SERVICE, "method")`.

  return { container, queryStore };
}

export function AppProviders({ children }: { children: ReactNode }) {
  const { container, queryStore } = useMemo(() => createAppServices(), []);

  return (
    <ContainerProvider container={container}>
      <QueryStoreProvider store={queryStore}>{children}</QueryStoreProvider>
    </ContainerProvider>
  );
}
