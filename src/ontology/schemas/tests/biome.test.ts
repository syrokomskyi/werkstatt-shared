import { describe, it, expect } from "vitest";
import { biomeProvenanceSchema, biomeAxesSchema } from "../biome.ts";

describe("biomeProvenanceSchema", () => {
  it("is defined", () => {
    expect(biomeProvenanceSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => biomeProvenanceSchema.parse(null)).toThrow();
  });
});

describe("biomeAxesSchema", () => {
  it("is defined and parseable", () => {
    expect(biomeAxesSchema).toBeDefined();
    expect(() => biomeAxesSchema.parse(null)).toThrow();
  });
});
