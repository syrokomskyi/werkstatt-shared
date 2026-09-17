import { describe, it, expect } from "vitest";
import {
  revealVariantSchema,
  parallaxVariantSchema,
} from "../section-motion.ts";

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
