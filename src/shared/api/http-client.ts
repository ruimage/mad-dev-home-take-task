import { z } from "zod";

/** Error thrown for transport failures and response validation failures. */
export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: string;
      cause?: unknown;
    },
  ) {
    super(message, options ? { cause: options.cause } : undefined);
    this.name = "ApiError";
    this.status = options?.status;
    this.code = options?.code;
  }
}

export interface HttpClientOptions {
  baseUrl?: string;
  /** Injectable fetch — override in tests or for custom transports. */
  fetchFn?: typeof fetch;
}

/**
 * Transport-agnostic HTTP contract of the service layer.
 * Responses are validated with Zod schemas, so external data can
 * never leak into the app untyped.
 */
export interface HttpClient {
  get<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T>;
  post<T>(path: string, body: unknown, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T>;
  patch<T>(path: string, body: unknown, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T>;
  delete(path: string, signal?: AbortSignal): Promise<void>;
}

export class FetchHttpClient implements HttpClient {
  readonly #baseUrl: string;
  readonly #fetchFn: typeof fetch;

  constructor(options: HttpClientOptions = {}) {
    this.#baseUrl = options.baseUrl?.replace(/\/+$/, "") ?? "";
    // Bind to globalThis: detached `fetch` throws "Illegal invocation" in browsers.
    this.#fetchFn = options.fetchFn ?? fetch.bind(globalThis);
  }

  async get<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
    return this.#request("GET", path, schema, undefined, signal);
  }

  async post<T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.#request("POST", path, schema, body, signal);
  }

  async patch<T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.#request("PATCH", path, schema, body, signal);
  }

  async delete(path: string, signal?: AbortSignal): Promise<void> {
    await this.#request("DELETE", path, undefined, undefined, signal);
  }

  async #request<T>(
    method: string,
    path: string,
    schema: z.ZodType<T> | undefined,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.#fetchFn(this.#url(path), {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (cause) {
      throw new ApiError(`Network error requesting ${method} ${path}`, { cause });
    }

    if (!response.ok) {
      const parsed = z
        .object({ message: z.string(), code: z.string() })
        .safeParse(await response.json().catch(() => null));
      throw new ApiError(
        parsed.success
          ? parsed.data.message
          : `Request ${method} ${path} failed with status ${response.status}`,
        {
          status: response.status,
          code: parsed.success ? parsed.data.code : undefined,
        },
      );
    }

    if (!schema) return undefined as T;
    const parsed = schema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(`Response of ${method} ${path} failed validation`, {
        status: response.status,
        cause: parsed.error,
      });
    }
    return parsed.data as T;
  }

  #url(path: string): string {
    return `${this.#baseUrl}/${path.replace(/^\/+/, "")}`;
  }
}
