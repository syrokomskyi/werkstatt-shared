/*
<MODULE_CONTRACT>
<purpose>
Unit tests for effects covering namedEffectTargetSchema; effectTargetSchema; glassEffectSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>dp7-m000006: withDefaultEffects / resolveEffectsForTargetWithDefaults —
  fill-when-absent, authored-wins (incl. enabled:false opt-out), non-shadow
  kinds preserved, defaults constants pinned to the canonical cast values.</item>
  <item>RFC-1311: Compass header sweep — declares the effects suite's contract for test-file scaffold coverage.</item>
  <item>RFC-1530: review findings for RFC-1530 feather effect

- catalog-grid image-wrap gains position:relative so effect layers
  (glass::before on target: media) anchor to the frame, not the shell
- shared schema tests pin feather bounds (edges subset/empty/non-enum,
  extent cap, strict variant) and allowedKindsForTarget(media)
- registry test pins the asymmetric two-axis edge subset
- site-composition.md notes the mask covers the whole frame element</item>
  <item>RFC-1530: renumber feather RFC to RFC-1530 — parallel session took the earlier id</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import {
  namedEffectTargetSchema,
  effectTargetSchema,
  glassEffectSchema,
  effectSchema,
  effectAssignmentSchema,
  EFFECT_KIND_META,
  allowedKindsForTarget,
  resolveEffectsForTarget,
  resolveEffectsForTargetWithDefaults,
  withDefaultEffects,
  hasEnabledGlassEffect,
  DEFAULT_SECTION_CAST_DOWN,
  DEFAULT_SECTION_CAST_UP,
} from "../effects.ts";
import type { EffectAssignment } from "../effects.ts";
import type { z } from "zod";

type ParsedEffect = z.infer<typeof effectSchema>;

describe("namedEffectTargetSchema", () => {
  it("accepts valid targets", () => {
    expect(namedEffectTargetSchema.parse("section")).toBe("section");
    expect(namedEffectTargetSchema.parse("heading")).toBe("heading");
  });

  it("rejects invalid target", () => {
    expect(() => namedEffectTargetSchema.parse("unknown")).toThrow();
  });
});

describe("effectTargetSchema", () => {
  it("accepts slot targets", () => {
    expect(effectTargetSchema.parse("slot:my-slot")).toBe("slot:my-slot");
  });

  it("rejects invalid slot format", () => {
    expect(() => effectTargetSchema.parse("slot:")).toThrow();
  });
});

describe("glassEffectSchema", () => {
  it("accepts valid glass effect", () => {
    const result = glassEffectSchema.safeParse({ kind: "glass", enabled: true });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(() => glassEffectSchema.parse({ kind: "glass" })).toThrow();
  });

  it("rejects extra keys (strict)", () => {
    expect(() => glassEffectSchema.parse({ kind: "glass", enabled: true, extra: true })).toThrow();
  });
});

describe("effectSchema (discriminated union)", () => {
  it("accepts glass effect", () => {
    const result = effectSchema.safeParse({ kind: "glass", enabled: true });
    expect(result.success).toBe(true);
  });

  it("accepts shadow effect", () => {
    const result = effectSchema.safeParse({ kind: "shadow", enabled: true });
    expect(result.success).toBe(true);
  });

  it("accepts inset shadow effect", () => {
    const result = effectSchema.safeParse({
      kind: "shadow",
      enabled: true,
      inset: true,
      offsetY: -24,
    });
    expect(result.success).toBe(true);
  });

  it("accepts fade effect", () => {
    const result = effectSchema.safeParse({ kind: "fade", enabled: true });
    expect(result.success).toBe(true);
  });

  it("rejects unknown kind", () => {
    expect(() => effectSchema.parse({ kind: "unknown", enabled: true })).toThrow();
  });
});

describe("fadeEffectSchema", () => {
  it("accepts a bottom edge fade with all fields", () => {
    const result = effectSchema.safeParse({
      kind: "fade",
      enabled: true,
      edge: "bottom",
      color: "surface",
      opacity: 0.9,
      extent: 0.4,
    });
    expect(result.success).toBe(true);
  });

  it("rejects extent above 0.5", () => {
    const result = effectSchema.safeParse({ kind: "fade", enabled: true, extent: 0.6 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid edge", () => {
    const result = effectSchema.safeParse({ kind: "fade", enabled: true, edge: "diagonal" });
    expect(result.success).toBe(false);
  });
});

describe("featherEffectSchema (RFC-1530)", () => {
  it("accepts an authored edge subset and extent", () => {
    const result = effectSchema.safeParse({
      kind: "feather",
      enabled: true,
      edges: ["top", "left"],
      extent: 0.2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty edges array", () => {
    const result = effectSchema.safeParse({ kind: "feather", enabled: true, edges: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-enum edge", () => {
    const result = effectSchema.safeParse({
      kind: "feather",
      enabled: true,
      edges: ["diagonal"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects extent above 0.5", () => {
    const result = effectSchema.safeParse({ kind: "feather", enabled: true, extent: 0.6 });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown key (strict variant)", () => {
    const result = effectSchema.safeParse({ kind: "feather", enabled: true, color: "bg" });
    expect(result.success).toBe(false);
  });
});

describe("EFFECT_KIND_META", () => {
  it("has metadata for all effect kinds", () => {
    expect(EFFECT_KIND_META.glass.strategy).toBe("surface");
    // shadow renders as text-shadow on text targets and as box-shadow on
    // surface targets (e.g. a cast shadow under `section`).
    expect(EFFECT_KIND_META.shadow.strategy).toBe("both");
  });
});

describe("allowedKindsForTarget", () => {
  it("returns text kinds for heading", () => {
    const kinds = allowedKindsForTarget("heading");
    expect(kinds).toContain("shadow");
    expect(kinds).not.toContain("glass");
  });

  it("returns glass-only default for body", () => {
    const kinds = allowedKindsForTarget("body");
    expect(kinds).toEqual(["glass"]);
  });

  it("accepts lighten and fade on background", () => {
    const kinds = allowedKindsForTarget("background");
    expect(kinds).toContain("lighten");
    expect(kinds).toContain("fade");
  });

  it("accepts glass and shadow on section", () => {
    const kinds = allowedKindsForTarget("section");
    expect(kinds).toContain("glass");
    expect(kinds).toContain("shadow");
  });

  it("accepts glass and feather on media (RFC-1530)", () => {
    const kinds = allowedKindsForTarget("media");
    expect(kinds).toEqual(["glass", "feather"]);
  });

  it("accepts a shadow assignment on section via effectAssignmentSchema", () => {
    const result = effectAssignmentSchema.safeParse({
      target: "section",
      stack: [{ kind: "shadow", enabled: true, offsetY: 24, blur: 48, spread: -16 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects shadow on background via effectAssignmentSchema", () => {
    const result = effectAssignmentSchema.safeParse({
      target: "background",
      stack: [{ kind: "shadow", enabled: true }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects fade on heading via effectAssignmentSchema", () => {
    const result = effectAssignmentSchema.safeParse({
      target: "heading",
      stack: [{ kind: "fade", enabled: true }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts the generic surface pair on component-defined slot targets", () => {
    const kinds = allowedKindsForTarget("slot:footer-below");
    expect(kinds).toEqual(["glass", "shadow"]);
  });

  it("accepts a shadow assignment on a slot target via effectAssignmentSchema", () => {
    const result = effectAssignmentSchema.safeParse({
      target: "slot:footer-below",
      stack: [{ kind: "shadow", enabled: true, offsetY: 24, blur: 48, spread: -16 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects typographic kinds on slot targets", () => {
    const result = effectAssignmentSchema.safeParse({
      target: "slot:card-title",
      stack: [{ kind: "glow", enabled: true }],
    });
    expect(result.success).toBe(false);
  });
});

describe("resolveEffectsForTarget", () => {
  it("returns empty array when no assignments", () => {
    expect(resolveEffectsForTarget(undefined, "section")).toEqual([]);
  });

  it("returns effects for matching target", () => {
    const glassEffect: ParsedEffect = effectSchema.parse({ kind: "glass", enabled: true });
    const assignments: EffectAssignment[] = [{ target: "section", stack: [glassEffect] }];
    const effects = resolveEffectsForTarget(assignments, "section");
    expect(effects).toHaveLength(1);
  });
});

describe("platform default casts (dp7-m000006)", () => {
  it("pins the canonical cast values (warpgogol-authored parity)", () => {
    expect(DEFAULT_SECTION_CAST_DOWN).toMatchObject({
      kind: "shadow",
      enabled: true,
      offsetY: 24,
      blur: 48,
      spread: -16,
      opacity: 0.3,
    });
    expect(DEFAULT_SECTION_CAST_UP).toMatchObject({ offsetY: -24 });
  });

  it("fills a section shadow when no assignments exist", () => {
    const merged = withDefaultEffects(undefined, "section", [DEFAULT_SECTION_CAST_DOWN]);
    expect(merged).toHaveLength(1);
    expect(merged[0].target).toBe("section");
    expect(merged[0].stack[0]).toMatchObject({ kind: "shadow", offsetY: 24 });
  });

  it("appends the default to a target stack that lacks a shadow kind", () => {
    const assignments: EffectAssignment[] = [
      {
        target: "section",
        stack: [{ kind: "glass", enabled: true }],
      },
    ];
    const merged = withDefaultEffects(assignments, "section", [DEFAULT_SECTION_CAST_DOWN]);
    expect(merged[0].stack.map((e) => e.kind)).toEqual(["glass", "shadow"]);
    // does not mutate the input
    expect(assignments[0].stack).toHaveLength(1);
  });

  it("does not fill when an authored shadow is enabled", () => {
    const authored: EffectAssignment[] = [
      {
        target: "section",
        stack: [{ kind: "shadow", enabled: true, offsetY: 4 }],
      },
    ];
    const stack = resolveEffectsForTargetWithDefaults(authored, "section", [
      DEFAULT_SECTION_CAST_DOWN,
    ]);
    expect(stack).toHaveLength(1);
    expect(stack[0]).toMatchObject({ offsetY: 4 });
  });

  it("does not fill when an authored shadow is disabled (opt-out)", () => {
    const authored: EffectAssignment[] = [
      {
        target: "section",
        stack: [{ kind: "shadow", enabled: false }],
      },
    ];
    const stack = resolveEffectsForTargetWithDefaults(authored, "section", [
      DEFAULT_SECTION_CAST_UP,
    ]);
    expect(stack).toHaveLength(1);
    expect(stack[0].enabled).toBe(false);
  });

  it("leaves other targets untouched", () => {
    const assignments: EffectAssignment[] = [
      {
        target: "background",
        stack: [{ kind: "fade", enabled: true, edge: "right" }],
      },
    ];
    const merged = withDefaultEffects(assignments, "section", [DEFAULT_SECTION_CAST_DOWN]);
    expect(merged).toHaveLength(2);
    expect(merged[0].target).toBe("background");
    expect(merged[0].stack[0].kind).toBe("fade");
    expect(merged[1]).toMatchObject({ target: "section" });
  });

  it("fills only kinds absent from the authored stack", () => {
    const assignments: EffectAssignment[] = [
      {
        target: "section",
        stack: [{ kind: "shadow", enabled: true, offsetY: -12 }],
      },
    ];
    const stack = resolveEffectsForTargetWithDefaults(assignments, "section", [
      DEFAULT_SECTION_CAST_DOWN,
      { kind: "glass", enabled: true, blur: 8 },
    ]);
    expect(stack.map((e) => e.kind)).toEqual(["shadow", "glass"]);
  });
});

describe("hasEnabledGlassEffect", () => {
  it("returns true when glass effect is enabled", () => {
    const e: ParsedEffect = effectSchema.parse({ kind: "glass", enabled: true });
    expect(hasEnabledGlassEffect([e])).toBe(true);
  });

  it("returns false when glass effect is disabled", () => {
    const e: ParsedEffect = effectSchema.parse({ kind: "glass", enabled: false });
    expect(hasEnabledGlassEffect([e])).toBe(false);
  });

  it("returns false when no effects", () => {
    expect(hasEnabledGlassEffect(undefined)).toBe(false);
  });
});
