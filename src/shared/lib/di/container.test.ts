import { describe, expect, test } from "bun:test";
import { ServiceContainer, createToken } from "./container";

interface Greeter {
  greet(): string;
}

const GREETER = createToken<Greeter>("test.greeter");

const greeter: Greeter = { greet: () => "hello" };

describe("ServiceContainer", () => {
  test("registers and resolves services", () => {
    const container = new ServiceContainer().register(GREETER, greeter);
    expect(container.resolve(GREETER).greet()).toBe("hello");
  });

  test("resolve throws for unregistered tokens", () => {
    const container = new ServiceContainer();
    expect(() => container.resolve(GREETER)).toThrow(/test.greeter.*not registered/);
  });

  test("register throws on duplicate registration", () => {
    const container = new ServiceContainer().register(GREETER, greeter);
    expect(() => container.register(GREETER, greeter)).toThrow(/already registered/);
  });

  test("override replaces the implementation", () => {
    const container = new ServiceContainer()
      .register(GREETER, greeter)
      .override(GREETER, { greet: () => "hi" });
    expect(container.resolve(GREETER).greet()).toBe("hi");
  });

  test("has reflects registrations", () => {
    const container = new ServiceContainer().register(GREETER, greeter);
    expect(container.has(GREETER)).toBe(true);
    expect(container.has(createToken<Greeter>("other"))).toBe(false);
  });
});
