import { Result } from "effect";
import { ApiError } from "./http-client";

/**
 * Wraps a request into Effect's `Result` monad (the v4 successor of `Either`):
 * failures land in the error channel instead of being thrown.
 */
export async function tryRequest<TData>(
  request: () => Promise<TData>,
): Promise<Result.Result<TData, ApiError>> {
  try {
    return Result.succeed(await request());
  } catch (error) {
    return Result.fail(
      error instanceof ApiError
        ? error
        : new ApiError("Unexpected request error", { cause: error }),
    );
  }
}
