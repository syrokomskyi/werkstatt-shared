/*
<MODULE_CONTRACT>
<purpose>
RFC-1355 (DNA-116): Zod schema + types for the archetype `selection` block —
the agent-readable section-selection contract every section/component archetype
descriptor carries. Consumed by archetype.registry.validate (SECTION-SEM-01…06)
and archetype.registry.build (section-selection.generated.md projection).
</purpose>
<non-goals>
  <item>Do not parse YAML here — callers hand us the already-loaded `selection` node.</item>
  <item>Do not judge naming quality (form words, implementation vocabulary) — that is SECTION-SEM-05/06 warning logic in the validator.</item>
  <item>Do not resolve `avoidWhen[].use` against the live catalog — referential checks live in the validator (SECTION-SEM-03).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1355: initial selection contract — purpose 1..160 chars, useWhen 1..5, avoidWhen 0..5 (resolved Q-18: nearest-archetype obligation applies to NEW archetypes only), variants optional; VARIANT_PROP_MARKER for manifest propsSchema nodes.</item>
  <item>RFC-1355: step 1 — archetype selection schema + SECTION-SEM-01..06 at warning severity</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

/** RFC-1355: JSON-schema-node key that marks a manifest prop as a declared visual variant. */
export const VARIANT_PROP_MARKER = "x-variant";

export const SELECTION_PURPOSE_MAX_LENGTH = 160;
export const SELECTION_LIST_MAX_ITEMS = 5;

/**
 * A situation in which another archetype is the right choice. `use` names that
 * archetype id — referential validity (exists, not self) is SECTION-SEM-03's
 * job, the schema only enforces shape.
 */
export const archetypeAvoidWhenEntrySchema = z
  .object({
    when: z.string().min(1),
    use: z.string().min(1),
  })
  .strict();

/**
 * Declared visual variants: maps a manifest prop marked `x-variant: true` to a
 * meaning per enum value. Exact parity between `values` keys and the prop's
 * enum members is SECTION-SEM-04's job.
 */
export const archetypeVariantMapSchema = z
  .object({
    prop: z.string().min(1),
    values: z.record(z.string().min(1), z.string().min(1)),
  })
  .strict();

/**
 * The `selection` block on every section/component archetype descriptor.
 * `avoidWhen` may be empty for singular-purpose archetypes (resolved Q-18):
 * R3's nearest-archetype obligation applies to NEW archetypes only.
 */
export const archetypeSelectionSchema = z
  .object({
    purpose: z.string().min(1).max(SELECTION_PURPOSE_MAX_LENGTH),
    useWhen: z.array(z.string().min(1)).min(1).max(SELECTION_LIST_MAX_ITEMS),
    avoidWhen: z.array(archetypeAvoidWhenEntrySchema).max(SELECTION_LIST_MAX_ITEMS).default([]),
    variants: z.array(archetypeVariantMapSchema).optional(),
  })
  .strict();

export type ArchetypeAvoidWhenEntry = z.infer<typeof archetypeAvoidWhenEntrySchema>;
export type ArchetypeVariantMap = z.infer<typeof archetypeVariantMapSchema>;
export type ArchetypeSelection = z.infer<typeof archetypeSelectionSchema>;

/**
 * Parse, don't validate: descriptor schemas carry `selection` as unknown so a
 * malformed block surfaces as a SECTION-SEM-01 diagnostic instead of crashing
 * the whole catalog load. Consumers call this to get a typed contract.
 */
export function parseArchetypeSelection(value: unknown) {
  return archetypeSelectionSchema.safeParse(value);
}
