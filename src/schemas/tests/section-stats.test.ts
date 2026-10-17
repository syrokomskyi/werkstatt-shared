/*
<MODULE_CONTRACT>
<purpose>
Unit tests for section stats covering statItemSchema. It also guards the documented public contract and regression-sensitive edge cases.
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
import { statItemSchema } from "../section-stats.ts";

describe("statItemSchema", () => {
  it("accepts a valid stat item", () => {
    const result = statItemSchema.safeParse({
      label: "Users",
      value: "10K",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object", () => {
    const result = statItemSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
