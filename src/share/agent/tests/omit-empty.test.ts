import { describe, it, expect } from "vitest";
import { omitEmptyKnowledgeValues } from "../omit-empty.ts";

describe("omitEmptyKnowledgeValues", () => {
  it("is a function", () => {
    expect(typeof omitEmptyKnowledgeValues).toBe("function");
  });

  it("removes empty strings, null, undefined, empty arrays, and empty objects", () => {
    const input = { a: "value", b: "", c: null, d: undefined, e: [], f: {} };
    const result = omitEmptyKnowledgeValues(input);
    expect(result).not.toHaveProperty("b");
    expect(result).not.toHaveProperty("c");
    expect(result).not.toHaveProperty("d");
    expect(result).not.toHaveProperty("e");
    expect(result).not.toHaveProperty("f");
    expect(result).toHaveProperty("a", "value");
  });

  it("preserves false and 0 (schema-allowed falsy values)", () => {
    const input = { enabled: false, count: 0 };
    const result = omitEmptyKnowledgeValues(input);
    expect(result).toHaveProperty("enabled", false);
    expect(result).toHaveProperty("count", 0);
  });

  it("preserves non-empty arrays and objects", () => {
    const input = { items: [1, 2], nested: { x: 1 } };
    const result = omitEmptyKnowledgeValues(input);
    expect(result).toHaveProperty("items", [1, 2]);
    expect(result).toHaveProperty("nested", { x: 1 });
  });
});
