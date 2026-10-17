/*
<MODULE_CONTRACT>
<purpose>
Unit tests for standard list item covering standardListItemSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the standard suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { standardListItemSchema } from "../standard-list-item.ts";

describe("standardListItemSchema", () => {
  it("accepts a valid list item", () => {
    const result = standardListItemSchema.safeParse({
      text: "Test item",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object", () => {
    const result = standardListItemSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
