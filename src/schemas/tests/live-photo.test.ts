/*
<MODULE_CONTRACT>
<purpose>
Unit tests for live photo covering livePhotoTriggerSchema; livePhotoSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the live suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { livePhotoTriggerSchema, livePhotoSchema } from "../live-photo.ts";

describe("livePhotoTriggerSchema", () => {
  it("accepts valid triggers", () => {
    for (const t of ["in-viewport", "tap", "autoplay"]) {
      expect(livePhotoTriggerSchema.parse(t)).toBe(t);
    }
  });

  it("rejects invalid trigger", () => {
    expect(() => livePhotoTriggerSchema.parse("scroll")).toThrow();
  });
});

describe("livePhotoSchema", () => {
  it("accepts minimal valid object with defaults", () => {
    const result = livePhotoSchema.parse({ enabled: true });
    expect(result.enabled).toBe(true);
  });

  it("accepts full config", () => {
    const config = {
      enabled: true,
      trigger: "in-viewport",
      loop: true,
      tapBehavior: "toggle",
      preload: "metadata",
    };
    expect(livePhotoSchema.parse(config)).toEqual(config);
  });

  it("rejects unknown keys (strict)", () => {
    expect(() => livePhotoSchema.parse({ enabled: true, unknown: true })).toThrow();
  });

  it("rejects invalid trigger", () => {
    expect(() => livePhotoSchema.parse({ enabled: true, trigger: "scroll" })).toThrow();
  });
});
