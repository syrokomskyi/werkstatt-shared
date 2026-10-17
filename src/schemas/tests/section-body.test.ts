/*
<MODULE_CONTRACT>
<purpose>
Unit tests for section body covering sectionBodyKindSchema. It also guards the documented public contract and regression-sensitive edge cases.
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
import { sectionBodyKindSchema } from "../section-body.ts";

describe("sectionBodyKindSchema", () => {
  it("accepts valid body kinds", () => {
    const validKinds = ["list", "split-list", "stats", "cards", "paragraphs", "comparison", "rich"];
    for (const kind of validKinds) {
      const result = sectionBodyKindSchema.safeParse(kind);
      expect(result.success, `kind "${kind}" should be valid`).toBe(true);
    }
  });

  it("rejects invalid body kind", () => {
    expect(() => sectionBodyKindSchema.parse("accordion")).toThrow();
  });
});
