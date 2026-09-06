import { describe, it, expect } from "vitest";
import { recordClaimsSchema } from "../claims.ts";

describe("recordClaimsSchema", () => {
  it("accepts empty record", () => {
    expect(recordClaimsSchema.parse({})).toEqual({});
  });

  it("accepts a valid claims record", () => {
    const claims = {
      field1: {
        provenance: "external",
        asOf: "2026-01-01",
      },
    };
    const result = recordClaimsSchema.safeParse(claims);
    expect(result.success).toBe(true);
  });

  it("rejects non-object", () => {
    expect(() => recordClaimsSchema.parse("not an object")).toThrow();
  });
});
