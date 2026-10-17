/*
<MODULE_CONTRACT>
<purpose>
Unit tests for growth covering growthVendorSchema; systemGrowthSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the growth suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { systemGrowthSchema, growthVendorSchema } from "../growth.ts";

describe("growthVendorSchema", () => {
  it("is defined", () => {
    expect(growthVendorSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => growthVendorSchema.parse(null)).toThrow();
  });
});

describe("systemGrowthSchema", () => {
  it("is defined", () => {
    expect(systemGrowthSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => systemGrowthSchema.parse(null)).toThrow();
  });
});
