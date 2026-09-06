import { describe, it, expect } from "vitest";
import { systemVerificationSchema } from "../verification.ts";

describe("systemVerificationSchema", () => {
  it("is defined", () => {
    expect(systemVerificationSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => systemVerificationSchema.parse(null)).toThrow();
  });
});
