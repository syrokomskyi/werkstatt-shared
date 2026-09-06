import { describe, it, expect } from "vitest";
import { capabilityInputOutputSchema, capabilityRecordSchema } from "../capability.ts";

describe("capabilityInputOutputSchema", () => {
  it("is defined", () => {
    expect(capabilityInputOutputSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => capabilityInputOutputSchema.parse(null)).toThrow();
  });
});

describe("capabilityRecordSchema", () => {
  it("is defined", () => {
    expect(capabilityRecordSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => capabilityRecordSchema.parse(null)).toThrow();
  });
});
