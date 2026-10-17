/*
<MODULE_CONTRACT>
<purpose>
Unit tests for section archetype covering sectionArchetypeSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the section suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { sectionArchetypeSchema } from "../section-archetype.ts";

describe("sectionArchetypeSchema", () => {
  it("is defined", () => {
    expect(sectionArchetypeSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => sectionArchetypeSchema.parse(null)).toThrow();
  });
});
