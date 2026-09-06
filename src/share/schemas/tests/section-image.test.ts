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
