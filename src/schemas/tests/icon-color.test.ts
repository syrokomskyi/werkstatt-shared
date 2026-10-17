/*
<MODULE_CONTRACT>
<purpose>
Unit tests for icon color covering iconColorSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the icon suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { iconColorSchema } from "../icon-color.ts";

describe("iconColorSchema", () => {
  it("accepts valid icon colors", () => {
    for (const c of ["primary", "accent", "success", "warning", "error", "muted"]) {
      expect(iconColorSchema.parse(c)).toBe(c);
    }
  });

  it("rejects invalid icon colors", () => {
    expect(() => iconColorSchema.parse("blue")).toThrow();
    expect(() => iconColorSchema.parse("")).toThrow();
    expect(() => iconColorSchema.parse(123)).toThrow();
  });
});
