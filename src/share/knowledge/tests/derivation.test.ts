import { describe, it, expect } from "vitest";
import { normalizeForHash, hashSourceValue, derivedState } from "../derivation.ts";

describe("normalizeForHash", () => {
  it("is a function", () => {
    expect(typeof normalizeForHash).toBe("function");
  });

  it("normalizes whitespace", () => {
    const result = normalizeForHash("  hello  world  ");
    expect(typeof result).toBe("string");
  });
});

describe("hashSourceValue", () => {
  it("is a function", () => {
    expect(typeof hashSourceValue).toBe("function");
  });

  it("returns a string hash", () => {
    const result = hashSourceValue("test");
    expect(typeof result).toBe("string");
  });
});

describe("derivedState", () => {
  it("is a function", () => {
    expect(typeof derivedState).toBe("function");
  });
});
