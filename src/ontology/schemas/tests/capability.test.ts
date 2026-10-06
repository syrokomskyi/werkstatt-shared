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

// RFC-1211 AC-1: the closed `ui` block — accepts the declared shape, rejects unknown fields.
describe("capabilityRecordSchema ui block (RFC-1211)", () => {
  const base = {
    id: "lead.prepare",
    version: 1,
    kind: "action",
    sideEffect: "none",
    title: { en: "Preview" },
    description: { en: "Preview capability." },
    input: { type: "object", additionalProperties: false, properties: {} },
    output: { type: "object", additionalProperties: false, properties: {} },
    requires: { entitlements: ["agent.actions"], sections: [] },
    limits: { perMinutePerIp: 10, maxPayloadBytes: 1024 },
  };

  it("accepts ui: { resource: true }", () => {
    const parsed = capabilityRecordSchema.parse({
      ...base,
      ui: { resource: true, preferredFrameSize: { width: 480, height: 320 } },
    });
    expect(parsed.ui?.resource).toBe(true);
    expect(parsed.ui?.preferredFrameSize).toEqual({ width: 480, height: 320 });
  });

  it("rejects unknown fields inside ui", () => {
    expect(() =>
      capabilityRecordSchema.parse({ ...base, ui: { resource: true, script: "x.js" } }),
    ).toThrow();
  });

  it("rejects ui: { resource: false }", () => {
    expect(() => capabilityRecordSchema.parse({ ...base, ui: { resource: false } })).toThrow();
  });
});
