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
