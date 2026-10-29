import { describe, expect, test } from "bun:test";
import { QueryStore, trackQueries } from "./query-store";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("QueryStore", () => {
  test("tracks pending -> success with data", async () => {
    const store = new QueryStore();

    const promise = store.run("key", async () => ["a"]);
    expect(store.getState("key").status).toBe("pending");

    expect(await promise).toEqual(["a"]);
    expect(store.getState("key")).toEqual({ status: "success", data: ["a"], error: null });
  });

  test("tracks pending -> error with the error message", async () => {
    const store = new QueryStore();

    await store.run("key", async () => {
      throw new Error("boom");
    });

    expect(store.getState("key")).toEqual({ status: "error", data: null, error: "boom" });
  });

  test("deduplicates concurrent runs of the same key", async () => {
    const store = new QueryStore();
    let calls = 0;
    const fn = async () => {
      calls += 1;
      await delay(10);
      return calls;
    };

    const [first, second] = await Promise.all([store.run("key", fn), store.run("key", fn)]);

    expect(calls).toBe(1);
    expect(first).toBe(second);
  });

  test("keeps states of different keys independent", async () => {
    const store = new QueryStore();

    await Promise.all([
      store.run("a", async () => 1),
      store.run("b", async () => {
        throw new Error("nope");
      }),
    ]);

    expect(store.getState("a").status).toBe("success");
    expect(store.getState("b").status).toBe("error");
  });

  test("notifies subscribers on every state change", async () => {
    const store = new QueryStore();
    const events: string[] = [];
    const unsubscribe = store.subscribe(() => {
      events.push(store.getState("key").status);
    });

    await store.run("key", async () => 1);
    unsubscribe();

    expect(events).toEqual(["pending", "success"]);
  });
});

describe("trackQueries", () => {
  test("proxies methods into the store under prefix.method keys", async () => {
    const store = new QueryStore();
    const api = {
      getAll: async () => ["u1"],
      fail: async () => {
        throw new Error("nope");
      },
    };

    const tracked = trackQueries(api, store, "test.api");

    await tracked.getAll();
    expect(store.getState("test.api.getAll")).toEqual({
      status: "success",
      data: ["u1"],
      error: null,
    });

    await tracked.fail().catch(() => {});
    expect(store.getState("test.api.fail")).toEqual({
      status: "error",
      data: null,
      error: "nope",
    });
  });

  test("passes through non-function properties", () => {
    const store = new QueryStore();
    const tracked = trackQueries({ getAll: async () => [], version: 3 }, store, "test.api");

    expect(tracked.version).toBe(3);
  });
});
