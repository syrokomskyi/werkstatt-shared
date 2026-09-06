import { describe, it, expect } from "vitest";
import { omitEmptyKnowledgeValues } from "../omit-empty.ts";

describe("omitEmptyKnowledgeValues", () => {
  it("is a function", () => {
    expect(typeof omitEmptyKnowledgeValues).toBe("function");
  });

  it("removes empty values from an object", () => {
    const input = { a: "value", b: "", c: null, d: undefined, e: [] };
    const result = omitEmptyKnowledgeValues(input);
    expect(result).not.toHaveProperty("b");
    expect(result).not.toHaveProperty("c");
    expect(result).not.toHaveProperty("d");
    expect(result).toHaveProperty("a", "value");
  });
});
