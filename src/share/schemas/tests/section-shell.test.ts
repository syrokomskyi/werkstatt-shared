import { describe, it, expect } from "vitest";
import {
  sectionDensitySchema,
  sectionToneSchema,
  sectionContainerVariantSchema,
  sectionShellAnimatedSchema,
} from "../section-shell.ts";

describe("sectionDensitySchema", () => {
  it("accepts valid densities", () => {
    for (const d of ["compact", "normal", "spacious", "flush"]) {
      expect(sectionDensitySchema.parse(d)).toBe(d);
    }
  });

  it("rejects invalid density", () => {
    expect(() => sectionDensitySchema.parse("loose")).toThrow();
  });
});

describe("sectionToneSchema", () => {
  it("accepts valid tones", () => {
    for (const t of ["default", "warning", "success", "muted"]) {
      expect(sectionToneSchema.parse(t)).toBe(t);
    }
  });
});

describe("sectionContainerVariantSchema", () => {
  it("accepts valid variants", () => {
    for (const v of ["default", "narrow", "full"]) {
      expect(sectionContainerVariantSchema.parse(v)).toBe(v);
    }
  });
});

describe("sectionShellAnimatedSchema", () => {
  it("accepts valid values", () => {
    expect(sectionShellAnimatedSchema.parse("none")).toBe("none");
    expect(sectionShellAnimatedSchema.parse("reveal")).toBe("reveal");
  });
});
