import { createToken } from "@/shared/lib/di";
import type { HttpClient } from "./http-client";

/**
 * Token for the transport used by every service of the app.
 * Swap the implementation once here (e.g. `FetchHttpClient` -> a mock
 * or a different transport) without touching feature code.
 */
export const HTTP_CLIENT = createToken<HttpClient>("shared.api.http-client");
