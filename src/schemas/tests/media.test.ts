/*
<MODULE_CONTRACT>
<purpose>
Unit tests for media covering mediaProfileSchema; mediaTriggerSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the media suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { mediaProfileSchema, mediaTriggerSchema } from "../media.ts";

describe("mediaProfileSchema", () => {
  it("accepts valid profiles", () => {
    for (const p of ["feature", "background", "ambient"]) {
      expect(mediaProfileSchema.parse(p)).toBe(p);
    }
  });

  it("rejects invalid profile", () => {
    expect(() => mediaProfileSchema.parse("streaming")).toThrow();
  });
});

describe("mediaTriggerSchema", () => {
  it("accepts valid triggers", () => {
    for (const t of ["in-viewport", "tap", "autoplay"]) {
      expect(mediaTriggerSchema.parse(t)).toBe(t);
    }
  });

  it("rejects invalid trigger", () => {
    expect(() => mediaTriggerSchema.parse("scroll")).toThrow();
  });
});
