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
