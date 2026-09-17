import { describe, it, expect } from "vitest";
import { iconColorSchema } from "../icon-color.ts";

describe("iconColorSchema", () => {
  it("accepts valid icon colors", () => {
    for (const c of ["primary", "accent", "success", "warning", "error", "muted"]) {
      expect(iconColorSchema.parse(c)).toBe(c);
    }
  });

  it("rejects invalid icon colors", () => {
    expect(() => iconColorSchema.parse("blue")).toThrow();
    expect(() => iconColorSchema.parse("")).toThrow();
    expect(() => iconColorSchema.parse(123)).toThrow();
  });
});
