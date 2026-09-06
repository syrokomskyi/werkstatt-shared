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
