/*
<MODULE_CONTRACT>
<purpose>
Unit tests for page base covering componentOverridesSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the page suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { componentOverridesSchema } from "../page-base.ts";

describe("componentOverridesSchema", () => {
  it("accepts undefined (optional)", () => {
    expect(componentOverridesSchema.parse(undefined)).toBeUndefined();
  });

  it("accepts empty record", () => {
    expect(componentOverridesSchema.parse({})).toEqual({});
  });

  it("accepts a valid overrides map", () => {
    const overrides = {
      "components/Header": { title: "Custom" },
    };
    expect(componentOverridesSchema.parse(overrides)).toEqual(overrides);
  });
});
