import { describe, it, expect } from "vitest";
import { constellationSlotSchema, constellationSchema } from "../constellation.ts";

describe("constellationSlotSchema", () => {
  it("is defined", () => {
    expect(constellationSlotSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => constellationSlotSchema.parse(null)).toThrow();
  });
});

describe("constellationSchema", () => {
  it("is defined", () => {
    expect(constellationSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => constellationSchema.parse(null)).toThrow();
  });
});
