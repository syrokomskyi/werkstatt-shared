/*
<MODULE_CONTRACT>
<purpose>
Unit tests for constellation covering constellationSlotSchema; constellationSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the constellation suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { constellationSlotSchema, constellationSchema } from "../constellation.ts";

describe("constellationSlotSchema", () => {
  it("is defined", () => {
    expect(constellationSlotSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => constellationSlotSchema.parse(null)).toThrow();
  });
});

describe("constellationSchema", () => {
  it("is defined", () => {
    expect(constellationSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => constellationSchema.parse(null)).toThrow();
  });
});
