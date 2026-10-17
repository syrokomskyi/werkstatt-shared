/*
<MODULE_CONTRACT>
<purpose>
Unit tests for page output covering semanticPageTypeSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the page suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { semanticPageTypeSchema } from "../page-output.ts";

describe("semanticPageTypeSchema", () => {
  it("accepts valid page types", () => {
    const result = semanticPageTypeSchema.safeParse("home");
    expect(result.success).toBe(true);
  });

  it("rejects invalid page type", () => {
    expect(() => semanticPageTypeSchema.parse("invalid-type")).toThrow();
  });
});
