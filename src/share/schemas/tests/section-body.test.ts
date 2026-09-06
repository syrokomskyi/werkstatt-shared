import { describe, it, expect } from "vitest";
import { sectionBodyKindSchema } from "../section-body.ts";

describe("sectionBodyKindSchema", () => {
  it("accepts valid body kinds", () => {
    const validKinds = ["list", "split-list", "stats", "cards", "paragraphs", "comparison", "rich"];
    for (const kind of validKinds) {
      const result = sectionBodyKindSchema.safeParse(kind);
      expect(result.success, `kind "${kind}" should be valid`).toBe(true);
    }
  });

  it("rejects invalid body kind", () => {
    expect(() => sectionBodyKindSchema.parse("accordion")).toThrow();
  });
});
