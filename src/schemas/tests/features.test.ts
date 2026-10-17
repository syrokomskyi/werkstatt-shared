/*
<MODULE_CONTRACT>
<purpose>
Unit tests for features covering featurePolicyVisibilitySchema; featurePolicyBehaviorValueSchema; featurePolicySchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the features suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import {
  featurePolicyVisibilitySchema,
  featurePolicyBehaviorValueSchema,
  featurePolicySchema,
} from "../features.ts";

describe("featurePolicyVisibilitySchema", () => {
  it("accepts valid visibility values", () => {
    for (const v of ["enabled", "disabled", "hidden", "draft"]) {
      expect(featurePolicyVisibilitySchema.parse(v)).toBe(v);
    }
  });

  it("rejects invalid values", () => {
    expect(() => featurePolicyVisibilitySchema.parse("visible")).toThrow();
  });
});

describe("featurePolicyBehaviorValueSchema", () => {
  it("accepts string values", () => {
    expect(featurePolicyBehaviorValueSchema.parse("hello")).toBe("hello");
  });

  it("accepts number values", () => {
    expect(featurePolicyBehaviorValueSchema.parse(42)).toBe(42);
  });

  it("accepts boolean values", () => {
    expect(featurePolicyBehaviorValueSchema.parse(true)).toBe(true);
  });

  it("accepts null", () => {
    expect(featurePolicyBehaviorValueSchema.parse(null)).toBeNull();
  });

  it("rejects objects", () => {
    expect(() => featurePolicyBehaviorValueSchema.parse({})).toThrow();
  });
});

describe("featurePolicySchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expect(featurePolicySchema.parse({})).toEqual({});
  });

  it("accepts full policy", () => {
    const policy = {
      visibility: "enabled",
      behavior: { key: "value" },
      reason: "test",
      expiresAt: "2026-12-31",
      audience: "all",
    };
    expect(featurePolicySchema.parse(policy)).toEqual(policy);
  });

  it("rejects invalid visibility", () => {
    expect(() => featurePolicySchema.parse({ visibility: "invalid" })).toThrow();
  });
});
