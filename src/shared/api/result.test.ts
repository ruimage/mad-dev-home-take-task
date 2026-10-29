import { describe, expect, test } from "bun:test";
import { Result } from "effect";
import { ApiError } from "./http-client";
import { tryRequest } from "./result";

describe("tryRequest", () => {
  test("succeeds with resolved data", async () => {
    const result = await tryRequest(async () => 42);

    expect(Result.isSuccess(result)).toBe(true);
    expect(
      Result.match(result, {
        onFailure: () => 0,
        onSuccess: (data) => data,
      }),
    ).toBe(42);
  });

  test("keeps ApiError instances in the failure channel", async () => {
    const result = await tryRequest(async () => {
      throw new ApiError("boom", { status: 500 });
    });

    expect(Result.isFailure(result)).toBe(true);
    expect(
      Result.match(result, {
        onFailure: (error) => error.message,
        onSuccess: () => "",
      }),
    ).toBe("boom");
  });

  test("wraps unexpected errors into ApiError", async () => {
    const result = await tryRequest(async () => {
      throw new Error("nope");
    });

    expect(Result.isFailure(result)).toBe(true);
    expect(
      Result.match(result, {
        onFailure: (error) => error.message,
        onSuccess: () => "",
      }),
    ).toBe("Unexpected request error");
  });
});
