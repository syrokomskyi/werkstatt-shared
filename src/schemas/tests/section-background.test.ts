/*
<MODULE_CONTRACT>
<purpose>
Unit tests for section background covering sectionBackgroundSchema. It also guards the documented public contract and regression-sensitive edge cases.
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
import { sectionBackgroundSchema } from "../section-background.ts";

describe("sectionBackgroundSchema", () => {
  it("accepts color kind", () => {
    const result = sectionBackgroundSchema.safeParse({ kind: "color" });
    expect(result.success).toBe(true);
  });

  it("accepts image kind with imageName", () => {
    const result = sectionBackgroundSchema.safeParse({
      kind: "image",
      imageName: "hero-bg",
    });
    expect(result.success).toBe(true);
  });

  it("accepts transparent kind", () => {
    const result = sectionBackgroundSchema.safeParse({ kind: "transparent" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid kind", () => {
    expect(() => sectionBackgroundSchema.parse({ kind: "video" })).toThrow();
  });

  it("rejects image kind without imageName", () => {
    const result = sectionBackgroundSchema.safeParse({ kind: "image" });
    expect(result.success).toBe(false);
  });
});
