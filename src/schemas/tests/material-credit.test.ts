import { describe, it, expect } from "vitest";
import {
  materialKindSchema,
  materialSourceTypeSchema,
  creditPartyKindSchema,
  creditRoleSchema,
} from "../material-credit.ts";

describe("materialKindSchema", () => {
  it("accepts valid kinds", () => {
    const result = materialKindSchema.safeParse("image");
    expect(result.success).toBe(true);
  });

  it("rejects invalid kind", () => {
    expect(() => materialKindSchema.parse("3d-model")).toThrow();
  });
});

describe("materialSourceTypeSchema", () => {
  it("accepts valid source types", () => {
    const result = materialSourceTypeSchema.safeParse("human-made");
    expect(result.success).toBe(true);
  });

  it("rejects invalid source type", () => {
    expect(() => materialSourceTypeSchema.parse("unknown")).toThrow();
  });
});

describe("creditPartyKindSchema", () => {
  it("accepts valid party kinds", () => {
    const result = creditPartyKindSchema.safeParse("Person");
    expect(result.success).toBe(true);
  });

  it("rejects invalid party kind", () => {
    expect(() => creditPartyKindSchema.parse("Robot")).toThrow();
  });
});

describe("creditRoleSchema", () => {
  it("accepts valid roles", () => {
    const result = creditRoleSchema.safeParse("creator");
    expect(result.success).toBe(true);
  });

  it("rejects invalid role", () => {
    expect(() => creditRoleSchema.parse("owner")).toThrow();
  });
});
