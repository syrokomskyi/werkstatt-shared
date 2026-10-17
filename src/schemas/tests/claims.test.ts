/*
<MODULE_CONTRACT>
<purpose>
Unit tests for claims covering recordClaimsSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the claims suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

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
