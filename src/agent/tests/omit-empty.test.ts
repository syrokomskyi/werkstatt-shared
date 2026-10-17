/*
<MODULE_CONTRACT>
<purpose>
Unit tests for omit empty covering omitEmptyKnowledgeValues. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the omit suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

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
