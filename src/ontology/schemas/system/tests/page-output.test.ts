import { describe, it, expect } from "vitest";
import { semanticPageTypeSchema } from "../page-output.ts";

describe("semanticPageTypeSchema", () => {
  it("accepts valid page types", () => {
    const result = semanticPageTypeSchema.safeParse("home");
    expect(result.success).toBe(true);
  });

  it("rejects invalid page type", () => {
    expect(() => semanticPageTypeSchema.parse("invalid-type")).toThrow();
  });
});
