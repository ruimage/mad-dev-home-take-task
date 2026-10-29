import { z } from "zod";

/** Error thrown for transport failures and response validation failures. */
export class ApiError extends Error {
  readonly status?: number;

  constructor(
    message: string,
    options?: {
      status?: number;
      cause?: unknown;
    },
  ) {
    super(message, options ? { cause: options.cause } : undefined);
    this.name = "ApiError";
    this.status = options?.status;
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
  get<T>(path: string, schema: z.ZodType<T>): Promise<T>;
  post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T>;
}

export class FetchHttpClient implements HttpClient {
  readonly #baseUrl: string;
  readonly #fetchFn: typeof fetch;

  constructor(options: HttpClientOptions = {}) {
    this.#baseUrl = options.baseUrl?.replace(/\/+$/, "") ?? "";
    // Bind to globalThis: detached `fetch` throws "Illegal invocation" in browsers.
    this.#fetchFn = options.fetchFn ?? fetch.bind(globalThis);
  }

  async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    return this.#request("GET", path, schema, undefined);
  }

  async post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    return this.#request("POST", path, schema, body);
  }

  async #request<T>(method: string, path: string, schema: z.ZodType<T>, body: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.#fetchFn(this.#url(path), {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      throw new ApiError(`Network error requesting ${method} ${path}`, { cause });
    }

    if (!response.ok) {
      throw new ApiError(`Request ${method} ${path} failed with status ${response.status}`, {
        status: response.status,
      });
    }

    const json: unknown = await response.json();
    const parsed = schema.safeParse(json);
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
