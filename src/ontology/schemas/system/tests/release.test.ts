import { describe, it, expect } from "vitest";
import { systemPassportSchema, systemReleaseSchema } from "../release.ts";

describe("systemPassportSchema", () => {
  it("is defined", () => {
    expect(systemPassportSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => systemPassportSchema.parse(null)).toThrow();
  });
});

describe("systemReleaseSchema", () => {
  it("is defined", () => {
    expect(systemReleaseSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => systemReleaseSchema.parse(null)).toThrow();
  });
});
