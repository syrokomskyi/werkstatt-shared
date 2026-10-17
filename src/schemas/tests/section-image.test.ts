/*
<MODULE_CONTRACT>
<purpose>
Unit tests for section image covering sectionImageParallaxPropSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the section suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { sectionImageParallaxPropSchema } from "../section-image.ts";

describe("sectionImageParallaxPropSchema", () => {
  it("accepts boolean", () => {
    expect(sectionImageParallaxPropSchema.parse(true)).toBe(true);
    expect(sectionImageParallaxPropSchema.parse(false)).toBe(false);
  });

  it("accepts number in range 0..2", () => {
    expect(sectionImageParallaxPropSchema.parse(0)).toBe(0);
    expect(sectionImageParallaxPropSchema.parse(1)).toBe(1);
    expect(sectionImageParallaxPropSchema.parse(2)).toBe(2);
  });

  it("rejects number out of range", () => {
    expect(() => sectionImageParallaxPropSchema.parse(3)).toThrow();
    expect(() => sectionImageParallaxPropSchema.parse(-1)).toThrow();
  });

  it("rejects string", () => {
    expect(() => sectionImageParallaxPropSchema.parse("subtle")).toThrow();
  });
});
