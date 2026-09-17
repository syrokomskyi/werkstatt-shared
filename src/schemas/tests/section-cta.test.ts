import { describe, it, expect } from "vitest";
import {
  ctaVariantSchema,
  ctaSizeSchema,
  ctaIconPositionSchema,
} from "../section-cta.ts";

describe("ctaVariantSchema", () => {
  it("accepts valid variants", () => {
    for (const v of ["primary", "secondary", "ghost", "danger"]) {
      expect(ctaVariantSchema.parse(v)).toBe(v);
    }
  });

  it("rejects invalid variant", () => {
    expect(() => ctaVariantSchema.parse("link")).toThrow();
  });
});

describe("ctaSizeSchema", () => {
  it("accepts valid sizes", () => {
    for (const s of ["sm", "md", "lg"]) {
      expect(ctaSizeSchema.parse(s)).toBe(s);
    }
  });

  it("rejects invalid size", () => {
    expect(() => ctaSizeSchema.parse("xl")).toThrow();
  });
});

describe("ctaIconPositionSchema", () => {
  it("accepts valid positions", () => {
    expect(ctaIconPositionSchema.parse("leading")).toBe("leading");
    expect(ctaIconPositionSchema.parse("trailing")).toBe("trailing");
  });

  it("rejects invalid position", () => {
    expect(() => ctaIconPositionSchema.parse("top")).toThrow();
  });
});
