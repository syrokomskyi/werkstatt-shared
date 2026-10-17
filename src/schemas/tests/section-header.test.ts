/*
<MODULE_CONTRACT>
<purpose>
Unit tests for section header covering headingToneSchema; sectionHeaderLevelSchema. It also guards the documented public contract and regression-sensitive edge cases.
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
import { headingToneSchema, sectionHeaderLevelSchema } from "../section-header.ts";

describe("headingToneSchema", () => {
  it("accepts valid tones", () => {
    for (const t of ["default", "primary", "accent", "muted", "inverse"]) {
      expect(headingToneSchema.parse(t)).toBe(t);
    }
  });

  it("rejects invalid tone", () => {
    expect(() => headingToneSchema.parse("bright")).toThrow();
  });
});

describe("sectionHeaderLevelSchema", () => {
  it("accepts level 1", () => {
    expect(sectionHeaderLevelSchema.parse(1)).toBe(1);
  });

  it("accepts level 2", () => {
    expect(sectionHeaderLevelSchema.parse(2)).toBe(2);
  });

  it("rejects level 3", () => {
    expect(() => sectionHeaderLevelSchema.parse(3)).toThrow();
  });
});
