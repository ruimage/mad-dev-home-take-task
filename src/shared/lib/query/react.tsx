import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useService, type ServiceToken } from "@/shared/lib/di";
import { QueryStore, type QueryState } from "./query-store";

const QueryStoreContext = createContext<QueryStore | null>(null);

export function QueryStoreProvider({
  store,
  children,
}: {
  store: QueryStore;
  children: ReactNode;
}) {
  return <QueryStoreContext.Provider value={store}>{children}</QueryStoreContext.Provider>;
}

/** Extracts the resolved data type of a service method returning a promise. */
type QueryData<TService, TMethod extends keyof TService> = TService[TMethod] extends (
  ...args: never[]
) => Promise<infer TData>
  ? TData
  : never;

export interface ServiceQuery<TData> extends QueryState<TData> {
  refetch: () => void;
}

/**
 * Runs a DI service method on mount and subscribes to its query state.
 * The service must be registered through `trackQueries` (see app/providers/di.tsx);
 * every call updates the shared QueryStore this hook reads from.
 */
export function useServiceQuery<TService extends object, TMethod extends keyof TService & string>(
  token: ServiceToken<TService>,
  method: TMethod,
): ServiceQuery<QueryData<TService, TMethod>> {
  const service = useService(token);
  const store = useContext(QueryStoreContext);
  if (store === null) {
    throw new Error("useServiceQuery must be used within a <QueryStoreProvider>");
  }

  const key = `${token.name}.${method}`;
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const state = useSyncExternalStore(
    subscribe,
    () => store.getState(key) as QueryState<QueryData<TService, TMethod>>,
  );

  const refetch = useCallback(() => {
    void (service[method] as () => Promise<unknown>)();
  }, [service, method]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
