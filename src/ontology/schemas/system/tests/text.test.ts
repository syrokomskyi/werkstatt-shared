/*
<MODULE_CONTRACT>
<purpose>
Unit tests for text covering systemTextSchema; systemTextNormalizeSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the text suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { systemTextSchema, systemTextNormalizeSchema } from "../text.ts";

describe("systemTextSchema", () => {
  it("is defined", () => {
    expect(systemTextSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => systemTextSchema.parse(null)).toThrow();
  });
});

describe("systemTextNormalizeSchema", () => {
  it("is defined", () => {
    expect(systemTextNormalizeSchema).toBeDefined();
  });
});
