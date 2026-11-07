/*
<MODULE_CONTRACT>
<purpose>
Canonical composable UI effects contract for shared sections and components.
Owns effect targets, discriminated effect kinds, assignment arrays, and
schema validation for the RFC-0134 glass-first effects model.
</purpose>
<non-goals>
  <item>Do not render effects — rendering belongs to @warpgogol/werkstatt-site/ui.</item>
  <item>Do not implement future effect kinds beyond glass in the initial wave.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>warpgogol-m000200: slot:* effect targets admit the generic surface pair (glass, shadow) — component-defined slots such as the footer's slot:footer-below pass strict effectAssignmentSchema validation.</item>
  <item>warpgogol-m000200: shadow effect gains `inset` — an inward cast for bottom-edge surfaces (e.g. slot:footer-below) that must not reserve document space below the element; box-shadow ink overflow never extends the scroll area, so outward bottom casts are unrenderable there.</item>
  <item>RFC-1485: sweep compass headers — shared-tail</item>
  <item>RFC-1530: feather effect kind on the media target (RFC-1530)

Add a contract-level feather kind — an alpha-transparency mask that fades
media edges to 0 — to the closed effects vocabulary, and wire catalog-grid
to resolve the media target onto each card's image frame.

- werkstatt-shared: featherEffectSchema (edges, extent), EFFECT_KIND_META
  surface/maxPerStack 1, TARGET_ALLOWED_KINDS.media = [glass, feather]
- registry: buildFeatherMask composes per-axis gradients; RENDERERS.feather
  emits effect-host--feather + --ds-effect-feather-mask
- effect-host.css: mask-image + -webkit- pair, mask-composite intersect,
  print suppression
- catalog-grid-section.astro: resolveEffectsForTarget(media) once per
  block, presentation on catalog-grid-section__image-wrap
- tests: schema accept/reject, duplicate stack, media x fade rejection,
  renderer defaults/subset/disabled/text-strategy</item>
  <item>RFC-1530: renumber feather RFC to RFC-1530 — parallel session took the earlier id</item>
  <history>dp7-m000006, RFC-1097, RFC-1420</history>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

const NAMED_EFFECT_TARGETS = [
  "section",
  "body",
  "panel",
  "item",
  "card",
  "row",
  "column",
  "media",
  "cta",
  "heading", // RFC-0151 — typographic effects on the section heading
  "subheading", // typographic effects on the section subheading/tagline
  "background", // lighten overlay on the section background image
] as const;

export const namedEffectTargetSchema = z.enum(NAMED_EFFECT_TARGETS);
const slotEffectTargetSchema = z.string().regex(/^slot:[a-z0-9-]+$/);
export const effectTargetSchema = z.union([namedEffectTargetSchema, slotEffectTargetSchema]);
export type EffectTarget = z.infer<typeof effectTargetSchema>;

export const glassEffectSchema = z
  .object({
    kind: z.literal("glass"),
    enabled: z.boolean(),
    blur: z.number().min(0).max(64).optional(),
    saturate: z.number().min(0).max(400).optional(),
    tint: z.string().min(1).optional(),
    tintOpacity: z.number().min(0).max(1).optional(),
    border: z.enum(["hairline", "none"]).optional(),
  })
  .strict();
export type GlassEffect = z.infer<typeof glassEffectSchema>;

/**
 * RFC-0151 — shared color alias for typographic effects. Either a biome token
 * alias resolved by the renderer, or a raw passthrough value (e.g. "#0af").
 */
export const effectColorSchema = z.union([
  z.enum(["text", "primary", "accent", "shadow", "surface", "inverse"]),
  z.string().min(1),
]);
export type EffectColor = z.infer<typeof effectColorSchema>;

export const shadowEffectSchema = z
  .object({
    kind: z.literal("shadow"),
    enabled: z.boolean(),
    offsetX: z.number().min(-64).max(64).optional(),
    offsetY: z.number().min(-64).max(64).optional(),
    blur: z.number().min(0).max(64).optional(),
    /** Box-shadow spread — only meaningful for the surface (section) render. */
    spread: z.number().min(-64).max(64).optional(),
    /** Paint the cast INSIDE the surface edge instead of outside it — used by
        bottom-edge casts (e.g. slot:footer-below) that must not reserve page
        space below the element. Text-shadow strategy ignores inset. */
    inset: z.boolean().optional(),
    color: effectColorSchema.optional(),
    opacity: z.number().min(0).max(1).optional(),
  })
  .strict();
export type ShadowEffect = z.infer<typeof shadowEffectSchema>;

export const glowEffectSchema = z
  .object({
    kind: z.literal("glow"),
    enabled: z.boolean(),
    blur: z.number().min(0).max(96).optional(),
    color: effectColorSchema.optional(),
    opacity: z.number().min(0).max(1).optional(),
  })
  .strict();
export type GlowEffect = z.infer<typeof glowEffectSchema>;

export const bulgeEffectSchema = z
  .object({
    kind: z.literal("bulge"),
    enabled: z.boolean(),
    depth: z.number().min(0).max(16).optional(),
    highlight: z.number().min(0).max(1).optional(),
    shade: z.number().min(0).max(1).optional(),
    shadowColor: effectColorSchema.optional(),
    highlightColor: effectColorSchema.optional(),
  })
  .strict();
export type BulgeEffect = z.infer<typeof bulgeEffectSchema>;

export const tiltEffectSchema = z
  .object({
    kind: z.literal("tilt"),
    enabled: z.boolean(),
    rotate: z.number().min(-15).max(15).optional(),
    skewX: z.number().min(-15).max(15).optional(),
  })
  .strict();
export type TiltEffect = z.infer<typeof tiltEffectSchema>;

/** RFC-1420: lighten is a uniform tint over the whole target — for a directional edge fade use kind: fade. */
export const lightenEffectSchema = z
  .object({
    kind: z.literal("lighten"),
    enabled: z.boolean(),
    /** 0..1; opacity of the lightening overlay above the background image. */
    opacity: z.number().min(0).max(1).optional(),
    /** Color alias or raw value for the overlay. Defaults to --ds-color-bg. */
    color: effectColorSchema.optional(),
  })
  .strict();
export type LightenEffect = z.infer<typeof lightenEffectSchema>;

/** RFC-1420: fade is the directional gradient from an edge — the light-surface hero veil mechanism. */
export const fadeEffectSchema = z
  .object({
    kind: z.literal("fade"),
    enabled: z.boolean(),
    /** Edge the fade rises from. Default: "bottom". */
    edge: z.enum(["top", "bottom", "left", "right"]).optional(),
    /** Color alias or raw value for the fade color. Defaults to --ds-color-bg. */
    color: effectColorSchema.optional(),
    /** 0..1; opacity of the fade color at the edge. Default 1. */
    opacity: z.number().min(0).max(1).optional(),
    /** 0..0.5; fade band width as a fraction of the element. Default 0.35. */
    extent: z.number().min(0).max(0.5).optional(),
  })
  .strict();
export type FadeEffect = z.infer<typeof fadeEffectSchema>;

/**
 * RFC-1530: feather is a transparency mask on the media's own edges — alpha
 * fades to 0 across `extent` at each enabled edge. Unlike `fade` it never
 * paints a color; unlike glass it modifies the media itself.
 */
export const featherEffectSchema = z
  .object({
    kind: z.literal("feather"),
    enabled: z.boolean(),
    /** Edge subset to feather. Default: all four edges. */
    edges: z
      .array(z.enum(["top", "bottom", "left", "right"]))
      .min(1)
      .optional(),
    /** 0..0.5; fade band width per edge as a fraction of the element. Default 0.15. */
    extent: z.number().min(0).max(0.5).optional(),
  })
  .strict();
export type FeatherEffect = z.infer<typeof featherEffectSchema>;

export const effectSchema = z.discriminatedUnion("kind", [
  glassEffectSchema,
  shadowEffectSchema,
  glowEffectSchema,
  bulgeEffectSchema,
  tiltEffectSchema,
  lightenEffectSchema,
  fadeEffectSchema,
  featherEffectSchema,
]);
export type Effect = z.infer<typeof effectSchema>;

export type EffectKind = Effect["kind"];
export type EffectRenderStrategy = "surface" | "text";
/** Kinds that render under both strategies (text-shadow vs box-shadow) declare "both". */
type EffectKindStrategy = EffectRenderStrategy | "both";

/**
 * RFC-0151 — per-kind metadata. Single source of truth shared by the stack
 * validator (maxPerStack) and the @warpgogol/werkstatt-site/ui renderer (strategy).
 */
export const EFFECT_KIND_META = {
  glass: { strategy: "surface", maxPerStack: 1 },
  shadow: { strategy: "both", maxPerStack: 1 },
  glow: { strategy: "text", maxPerStack: 1 },
  bulge: { strategy: "text", maxPerStack: 1 },
  tilt: { strategy: "text", maxPerStack: 1 },
  lighten: { strategy: "surface", maxPerStack: 1 },
  fade: { strategy: "surface", maxPerStack: 1 },
  feather: { strategy: "surface", maxPerStack: 1 },
} as const satisfies Record<EffectKind, { strategy: EffectKindStrategy; maxPerStack: number }>;

/**
 * RFC-0151 — which effect kinds each target accepts. Targets absent from this
 * map default to glass-only (the RFC-0134 surface behavior). The `heading`
 * target accepts only the typographic (text-strategy) kinds.
 */
export const TARGET_ALLOWED_KINDS: Record<string, readonly EffectKind[]> = {
  heading: ["shadow", "glow", "bulge", "tilt"],
  subheading: ["shadow", "glow", "bulge", "tilt"],
  background: ["lighten", "fade"],
  /** Cast shadow below the section boundary (box-shadow), plus surface glass. */
  section: ["glass", "shadow"],
  /** RFC-1530: a media frame is a surface — the generic surface pair holds
      here too (glass stays admitted like on `section`/`slot:*`, feather is
      the edge-alpha mask this target exists for). */
  media: ["glass", "feather"],
};

const DEFAULT_ALLOWED_KINDS: readonly EffectKind[] = ["glass"];

/**
 * Component-defined named slots (`slot:*`) are surface attachment points
 * owned by the component contract (RFC-0134) — e.g. the footer's
 * `slot:footer-below` carries a second cast layer. They accept the generic
 * surface pair, same as `section`; the component declares which named slots
 * it resolves.
 */
const SLOT_ALLOWED_KINDS: readonly EffectKind[] = ["glass", "shadow"];

/** RFC-0151 — kinds accepted by a target, falling back to the glass-only default. */
export function allowedKindsForTarget(target: EffectTarget): readonly EffectKind[] {
  if (target.startsWith("slot:")) return SLOT_ALLOWED_KINDS;
  return TARGET_ALLOWED_KINDS[target] ?? DEFAULT_ALLOWED_KINDS;
}

export const effectStackSchema = z
  .array(effectSchema)
  .min(1)
  .superRefine((stack, ctx) => {
    const counts = new Map<EffectKind, number>();
    for (const effect of stack) {
      counts.set(effect.kind, (counts.get(effect.kind) ?? 0) + 1);
    }
    for (const [kind, count] of counts) {
      const max = EFFECT_KIND_META[kind].maxPerStack;
      if (count > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Only ${max} ${kind} effect(s) allowed per effect stack.`,
        });
      }
    }
  });

export const effectAssignmentSchema = z
  .object({
    target: effectTargetSchema,
    stack: effectStackSchema,
  })
  .strict()
  .superRefine((assignment, ctx) => {
    // RFC-0151 — target × kind admissibility. A heading accepts only the
    // typographic kinds; surface targets accept only glass. This is the
    // contract guard the RFC describes, enforced wherever content is validated.
    const allowed = allowedKindsForTarget(assignment.target);
    for (const effect of assignment.stack) {
      if (!allowed.includes(effect.kind)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stack"],
          message: `Target '${assignment.target}' supports kinds [${allowed.join(", ")}], not '${effect.kind}'.`,
        });
      }
    }
  });
export type EffectAssignment = z.infer<typeof effectAssignmentSchema>;

export const effectsSchema = z.array(effectAssignmentSchema).min(1);
export type Effects = z.infer<typeof effectsSchema>;

export function resolveEffectsForTarget(
  assignments: readonly EffectAssignment[] | undefined,
  target: EffectTarget,
): Effect[] {
  return assignments?.find((assignment) => assignment.target === target)?.stack ?? [];
}

/**
 * dp7-m000006 — platform default surface casts. A surface that authors no
 * `kind: shadow` on `target: section` renders the default cast: downward under
 * the header and hero shells, upward above the footer shell. Authored always
 * wins per-kind — a `kind: shadow` stack item, enabled or not, supersedes the
 * default, so an explicit `enabled: false` is the per-site opt-out.
 */
export const DEFAULT_SECTION_CAST_DOWN: ShadowEffect = {
  kind: "shadow",
  enabled: true,
  offsetX: 0,
  offsetY: 24,
  blur: 48,
  spread: -16,
  opacity: 0.3,
};
export const DEFAULT_SECTION_CAST_UP: ShadowEffect = {
  ...DEFAULT_SECTION_CAST_DOWN,
  offsetY: -24,
};

/**
 * Merge platform defaults into an assignments list: each default whose kind is
 * absent from the target's authored stack is appended to that stack (the target
 * entry is created when missing). Authored always wins per-kind — an authored
 * item of the same kind, even a disabled one, owns that kind's presence on the
 * target, so the default never fills in on top of it.
 */
export function withDefaultEffects(
  assignments: readonly EffectAssignment[] | undefined,
  target: EffectTarget,
  defaults: readonly Effect[],
): EffectAssignment[] {
  const authoredKinds = new Set(
    resolveEffectsForTarget(assignments, target).map((effect) => effect.kind),
  );
  const fill = defaults.filter((effect) => !authoredKinds.has(effect.kind));
  const merged: EffectAssignment[] = (assignments ?? []).map((assignment) => ({
    ...assignment,
    stack: [...assignment.stack],
  }));
  if (fill.length === 0) return merged;
  const index = merged.findIndex((assignment) => assignment.target === target);
  if (index === -1) {
    merged.push({ target, stack: [...fill] });
  } else {
    merged[index]!.stack.push(...fill);
  }
  return merged;
}

/**
 * Resolve a target's stack with platform defaults applied — same per-kind fill
 * rule as {@link withDefaultEffects}, returning the flat stack directly.
 */
export function resolveEffectsForTargetWithDefaults(
  assignments: readonly EffectAssignment[] | undefined,
  target: EffectTarget,
  defaults: readonly Effect[],
): Effect[] {
  return resolveEffectsForTarget(withDefaultEffects(assignments, target, defaults), target);
}

export function hasEnabledGlassEffect(effects: readonly Effect[] | undefined): effects is Effect[] {
  return Boolean(effects?.some((effect) => effect.kind === "glass" && effect.enabled));
}

export function resolveGlassEffect(
  effects: readonly Effect[] | undefined,
): GlassEffect | undefined {
  return effects?.find(
    (effect): effect is GlassEffect => effect.kind === "glass" && effect.enabled,
  );
}
