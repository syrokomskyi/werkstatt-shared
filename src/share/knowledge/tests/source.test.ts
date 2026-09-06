import { describe, it, expect } from "vitest";
import { SOURCE_KINDS, sourceToleranceSchema } from "../source.ts";

describe("SOURCE_KINDS", () => {
  it("contains expected source kinds", () => {
    expect(SOURCE_KINDS).toContain("http-json");
    expect(SOURCE_KINDS).toContain("manual");
  });
});

describe("sourceToleranceSchema", () => {
  it("is defined", () => {
    expect(sourceToleranceSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => sourceToleranceSchema.parse(null)).toThrow();
  });
});
