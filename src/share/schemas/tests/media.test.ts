import { describe, it, expect } from "vitest";
import { mediaProfileSchema, mediaTriggerSchema } from "../media.ts";

describe("mediaProfileSchema", () => {
  it("accepts valid profiles", () => {
    for (const p of ["feature", "background", "ambient"]) {
      expect(mediaProfileSchema.parse(p)).toBe(p);
    }
  });

  it("rejects invalid profile", () => {
    expect(() => mediaProfileSchema.parse("streaming")).toThrow();
  });
});

describe("mediaTriggerSchema", () => {
  it("accepts valid triggers", () => {
    for (const t of ["in-viewport", "tap", "autoplay"]) {
      expect(mediaTriggerSchema.parse(t)).toBe(t);
    }
  });

  it("rejects invalid trigger", () => {
    expect(() => mediaTriggerSchema.parse("scroll")).toThrow();
  });
});
