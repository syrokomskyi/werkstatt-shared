import { describe, it, expect } from "vitest";
import { systemTextSchema, systemTextNormalizeSchema } from "../text.ts";

describe("systemTextSchema", () => {
  it("is defined", () => {
    expect(systemTextSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => systemTextSchema.parse(null)).toThrow();
  });
});

describe("systemTextNormalizeSchema", () => {
  it("is defined", () => {
    expect(systemTextNormalizeSchema).toBeDefined();
  });
});
