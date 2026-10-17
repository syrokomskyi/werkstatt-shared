/*
<MODULE_CONTRACT>
<purpose>
Unit tests for site family covering siteFamilySchema; SiteFamilyContract. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the site suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { siteFamilySchema, SiteFamilyContract } from "../site-family.ts";

describe("siteFamilySchema", () => {
  it("is defined", () => {
    expect(siteFamilySchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => siteFamilySchema.parse(null)).toThrow();
  });
});

describe("SiteFamilyContract", () => {
  it("is the same schema as siteFamilySchema", () => {
    expect(SiteFamilyContract).toBe(siteFamilySchema);
  });
});
