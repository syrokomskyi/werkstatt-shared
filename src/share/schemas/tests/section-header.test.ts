import { describe, it, expect } from "vitest";
import {
  headingToneSchema,
  sectionHeaderLevelSchema,
} from "../section-header.ts";

describe("headingToneSchema", () => {
  it("accepts valid tones", () => {
    for (const t of ["default", "primary", "accent", "muted", "inverse"]) {
      expect(headingToneSchema.parse(t)).toBe(t);
    }
  });

  it("rejects invalid tone", () => {
    expect(() => headingToneSchema.parse("bright")).toThrow();
  });
});

describe("sectionHeaderLevelSchema", () => {
  it("accepts level 1", () => {
    expect(sectionHeaderLevelSchema.parse(1)).toBe(1);
  });

  it("accepts level 2", () => {
    expect(sectionHeaderLevelSchema.parse(2)).toBe(2);
  });

  it("rejects level 3", () => {
    expect(() => sectionHeaderLevelSchema.parse(3)).toThrow();
  });
});
