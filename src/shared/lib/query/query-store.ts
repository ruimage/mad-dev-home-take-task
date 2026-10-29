export type QueryStatus = "pending" | "success" | "error";

export interface QueryState<TData = unknown> {
  status: QueryStatus;
  data: TData | null;
  error: string | null;
}

export type QueryListener = () => void;

const pendingState: QueryState = { status: "pending", data: null, error: null };

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Framework-free store with per-query state.
 * The DI proxy (`trackQueries`) writes here, React glue (`react.tsx`)
 * subscribes via `useSyncExternalStore`.
 */
export class QueryStore {
  readonly #states = new Map<string, QueryState>();
  readonly #inflight = new Map<string, Promise<unknown>>();
  readonly #listeners = new Set<QueryListener>();

  subscribe(listener: QueryListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  getState(key: string): QueryState {
    return this.#states.get(key) ?? pendingState;
  }

  /**
   * Runs an async query, tracking its state under `key`.
   * Concurrent runs of the same key are deduplicated: the second caller
   * receives the promise of the in-flight request.
   */
  run<TData>(key: string, fn: () => Promise<TData>): Promise<TData | null> {
    const inflight = this.#inflight.get(key);
    if (inflight !== undefined) {
      return inflight as Promise<TData | null>;
    }

    this.#states.set(key, { status: "pending", data: null, error: null });
    this.#notify();

    const promise = fn()
      .then((data: TData) => {
        this.#states.set(key, { status: "success", data, error: null });
        return data;
      })
      .catch((error: unknown) => {
        this.#states.set(key, { status: "error", data: null, error: toErrorMessage(error) });
        return null;
      })
      .finally(() => {
        this.#inflight.delete(key);
        this.#notify();
      });

    this.#inflight.set(key, promise);
    return promise;
  }

  #notify(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

/**
 * Wraps a service in a Proxy so that every method call is tracked by the
 * QueryStore under `<prefix>.<method>`. Services stay transport- and
 * framework-agnostic; the app layer decides which services are tracked.
 */
export function trackQueries<TService extends object>(
  service: TService,
  store: QueryStore,
  prefix: string,
): TService {
  return new Proxy<TService>(service, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") {
        return value;
      }
      const key = `${prefix}.${String(property)}`;
      return (...args: unknown[]) =>
        store.run(key, () =>
          (value as (...fnArgs: unknown[]) => Promise<unknown>).apply(target, args),
        ) as never;
    },
  });
}
