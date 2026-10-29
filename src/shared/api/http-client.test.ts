import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { z } from "zod";
import { ApiError, FetchHttpClient } from "./http-client";

const schema = z.object({ id: z.number() });
const BASE_URL = "https://api.example.com";

// Requests are intercepted at the network level by MSW, so the real
// fetch pipeline (url joining, response parsing, error mapping) is exercised.
const server = setupServer(
  http.get(`${BASE_URL}/users/1`, () => HttpResponse.json({ id: 1 })),
  http.get(`${BASE_URL}/users`, () => new HttpResponse("boom", { status: 500 })),
  http.post(`${BASE_URL}/users`, async ({ request }) => {
    const body = (await request.json()) as { name: string };
    return HttpResponse.json({ id: 2, name: body.name });
  }),
  http.patch(`${BASE_URL}/users/1`, () => HttpResponse.json({ id: 1 })),
  http.delete(`${BASE_URL}/users/1`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${BASE_URL}/conflict`, () =>
    HttpResponse.json({ code: "BOOKING_CONFLICT", message: "Time occupied" }, { status: 409 }),
  ),
  http.get(`${BASE_URL}/invalid`, () => HttpResponse.json({ id: "not-a-number" })),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("FetchHttpClient (via MSW)", () => {
  test("supports PATCH and DELETE with an empty 204 response", async () => {
    const client = new FetchHttpClient({ baseUrl: BASE_URL });
    expect(await client.patch("/users/1", {}, schema)).toEqual({ id: 1 });
    await expect(client.delete("/users/1")).resolves.toBeUndefined();
  });

  test("preserves server conflict status, code and message", async () => {
    const client = new FetchHttpClient({ baseUrl: BASE_URL });
    const error = await client.post("/conflict", {}, schema).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "BOOKING_CONFLICT",
      message: "Time occupied",
    });
  });
  test("parses validated responses", async () => {
    const client = new FetchHttpClient({ baseUrl: BASE_URL });

    expect(await client.get("/users/1", schema)).toEqual({ id: 1 });
  });

  test("joins baseUrl with the path regardless of trailing slashes", async () => {
    const client = new FetchHttpClient({ baseUrl: `${BASE_URL}/` });

    await expect(client.get("/users/1", schema)).resolves.toEqual({ id: 1 });
  });

  test("throws ApiError with status for failed requests", async () => {
    const client = new FetchHttpClient({ baseUrl: BASE_URL });
    const error: unknown = await client.get("/users", schema).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
  });

  test("throws ApiError when the response fails schema validation", async () => {
    const client = new FetchHttpClient({ baseUrl: BASE_URL });
    const error: unknown = await client.get("/invalid", schema).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toContain("failed validation");
  });

  test("sends JSON bodies with post", async () => {
    const client = new FetchHttpClient({ baseUrl: BASE_URL });

    // The schema strips unknown keys, so only `id` survives validation.
    expect(await client.post("/users", { name: "Alice" }, schema)).toEqual({ id: 2 });
  });

  test("throws ApiError for requests without a matching handler", async () => {
    const client = new FetchHttpClient({ baseUrl: BASE_URL });
    const error: unknown = await client.get("/unhandled", schema).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toContain("Network error");
  });
});
