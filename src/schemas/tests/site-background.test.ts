/*
<MODULE_CONTRACT>
<purpose>
Unit tests for site background covering siteBackgroundLayerSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the site suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { siteBackgroundLayerSchema } from "../site-background.ts";

describe("siteBackgroundLayerSchema", () => {
  it("accepts color kind", () => {
    const result = siteBackgroundLayerSchema.safeParse({ kind: "color" });
    expect(result.success).toBe(true);
  });

  it("accepts image kind with imageName", () => {
    const result = siteBackgroundLayerSchema.safeParse({
      kind: "image",
      imageName: "bg",
    });
    expect(result.success).toBe(true);
  });

  it("accepts gradient kind with required fields", () => {
    const result = siteBackgroundLayerSchema.safeParse({
      kind: "gradient",
      direction: "vertical",
      stops: [
        { at: 0, color: "#000" },
        { at: 1, color: "#fff" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid kind", () => {
    expect(() => siteBackgroundLayerSchema.parse({ kind: "video" })).toThrow();
  });
});
