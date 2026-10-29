/**
 * Minimal typed DI container (token-based, zero dependencies).
 *
 * Services for external sources (HTTP APIs, websockets, storages) are
 * registered in the app layer (`src/app/providers/di.tsx`) and consumed
 * through tokens, so any implementation can be swapped in tests or when
 * the transport changes.
 */

/** Phantom-typed service token. The type parameter never exists at runtime. */
export interface ServiceToken<T> {
  readonly name: string;
  /** @internal Phantom marker for compile-time type inference. */
  readonly __type?: T;
}

export function createToken<T>(name: string): ServiceToken<T> {
  return { name };
}

export class ServiceContainer {
  readonly #services = new Map<ServiceToken<unknown>, unknown>();

  /** Registers an implementation for a token. Throws on duplicate registration. */
  register<T>(token: ServiceToken<T>, implementation: T): this {
    if (this.#services.has(token)) {
      throw new Error(`Service "${token.name}" is already registered`);
    }
    this.#services.set(token, implementation);
    return this;
  }

  /** Replaces an existing registration (useful in tests). */
  override<T>(token: ServiceToken<T>, implementation: T): this {
    this.#services.set(token, implementation);
    return this;
  }

  /** Resolves a service by token. Throws when it was never registered. */
  resolve<T>(token: ServiceToken<T>): T {
    const service = this.#services.get(token);
    if (service === undefined) {
      throw new Error(`Service "${token.name}" is not registered`);
    }
    return service as T;
  }

  has<T>(token: ServiceToken<T>): boolean {
    return this.#services.has(token);
  }
}
