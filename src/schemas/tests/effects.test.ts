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
  hasEnabledGlassEffect,
} from "../effects.ts";
import type { EffectAssignment } from "../effects.ts";
import { z } from "zod";

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

describe("EFFECT_KIND_META", () => {
  it("has metadata for all effect kinds", () => {
    expect(EFFECT_KIND_META.glass.strategy).toBe("surface");
    expect(EFFECT_KIND_META.shadow.strategy).toBe("text");
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

  it("rejects fade on heading via effectAssignmentSchema", () => {
    const result = effectAssignmentSchema.safeParse({
      target: "heading",
      stack: [{ kind: "fade", enabled: true }],
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
