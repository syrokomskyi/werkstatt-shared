/*
<MODULE_CONTRACT>
<purpose>
Unit tests for section motion covering revealVariantSchema; parallaxVariantSchema. It also guards the documented public contract and regression-sensitive edge cases.
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
import { revealVariantSchema, parallaxVariantSchema } from "../section-motion.ts";

describe("revealVariantSchema", () => {
  it("accepts valid variants", () => {
    for (const v of ["fade", "fade-up", "fade-up-stagger"]) {
      expect(revealVariantSchema.parse(v)).toBe(v);
    }
  });

  it("rejects invalid variant", () => {
    expect(() => revealVariantSchema.parse("slide")).toThrow();
  });
});

describe("parallaxVariantSchema", () => {
  it("accepts valid variants", () => {
    for (const v of ["subtle", "balanced", "dramatic"]) {
      expect(parallaxVariantSchema.parse(v)).toBe(v);
    }
  });

  it("rejects invalid variant", () => {
    expect(() => parallaxVariantSchema.parse("extreme")).toThrow();
  });
});
