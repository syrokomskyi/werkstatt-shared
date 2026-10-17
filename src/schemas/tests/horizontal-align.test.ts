/*
<MODULE_CONTRACT>
<purpose>
Unit tests for horizontal align covering horizontalAlignSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the horizontal suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { horizontalAlignSchema } from "../horizontal-align.ts";

describe("horizontalAlignSchema", () => {
  it("accepts valid alignment values", () => {
    expect(horizontalAlignSchema.parse("left")).toBe("left");
    expect(horizontalAlignSchema.parse("center")).toBe("center");
    expect(horizontalAlignSchema.parse("right")).toBe("right");
  });

  it("rejects invalid alignment values", () => {
    expect(() => horizontalAlignSchema.parse("top")).toThrow();
    expect(() => horizontalAlignSchema.parse("")).toThrow();
    expect(() => horizontalAlignSchema.parse(null)).toThrow();
  });
});
