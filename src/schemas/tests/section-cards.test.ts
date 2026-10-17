/*
<MODULE_CONTRACT>
<purpose>
Unit tests for section cards covering standardCardSchema. It also guards the documented public contract and regression-sensitive edge cases.
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
import { standardCardSchema } from "../section-cards.ts";

describe("standardCardSchema", () => {
  it("accepts a valid card", () => {
    const result = standardCardSchema.safeParse({
      title: "Test Card",
      description: "Card body text",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object", () => {
    const result = standardCardSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
