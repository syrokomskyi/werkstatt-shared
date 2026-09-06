import { describe, it, expect } from "vitest";
import { sectionArchetypeSchema } from "../section-archetype.ts";

describe("sectionArchetypeSchema", () => {
  it("is defined", () => {
    expect(sectionArchetypeSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => sectionArchetypeSchema.parse(null)).toThrow();
  });
});
