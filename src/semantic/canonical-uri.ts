/*
<MODULE_CONTRACT>
  <purpose>RFC-1075: derive persistent canonical URIs for PBP entity envelopes from site origin and entity identity. Used for Linked Data @id fields in JSON-LD and llms-full.txt projections. RFC-1115: URIs carry a .json suffix and are dereferenceable — agent.knowledge.generate emits a static JSON-LD document at each path.</purpose>
  <non-goals>
    <item>Does not validate that the entity ID is well-formed — callers are responsible for providing valid IDs.</item>
    <item>Does not perform URL normalization beyond trailing-slash removal on the site origin.</item>
  </non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1075: initial — deriveCanonicalUri pure function for persistent entity @id URIs.</item>
  <item>RFC-1115: canonical entity URIs gain a .json suffix and become dereferenceable — agent.knowledge.generate emits a JSON-LD document at each emitted path.</item>
</CHANGE_SUMMARY>
*/

/**
 * Entity types supported by the PBP canonical URI scheme.
 *
 * The URI path pattern is `/.well-known/entity/{type}/{id}.json` for typed entities
 * (e.g. offerings) and `/.well-known/entity/business.json` for the single business entity.
 * RFC-1115: the .json suffix makes every URI dereferenceable on a static host —
 * agent.knowledge.generate emits a JSON-LD document at each path.
 */
export type CanonicalEntityType = "business" | "offering";

/**
 * RFC-1075: derive a persistent canonical URI for a PBP entity.
 *
 * The URI follows the pattern (RFC-1115 — dereferenceable .json form):
 * - Business: `{siteOrigin}/.well-known/entity/business.json`
 * - Offering: `{siteOrigin}/.well-known/entity/offering/{entityId}.json`
 *
 * The `siteOrigin` is stripped of trailing slashes to produce a clean base.
 * When `siteOrigin` is absent or empty, the function returns `undefined` —
 * callers should skip emitting `@id` in that case.
 *
 * @param siteOrigin - The site origin URL (e.g. `https://example.com`)
 * @param type - The entity type (`"business"` or `"offering"`)
 * @param entityId - The entity ID (required for `"offering"`, ignored for `"business"`)
 * @returns The canonical URI string, or `undefined` when `siteOrigin` is absent
 */
/**
 * Reduce a PBP entity id to the slug used in canonical entity URIs and file
 * paths. Entity IDs are URIs (e.g. `https://warpgogol.com/id/offerings/automation`);
 * the last non-empty path segment is the slug (`automation`). Plain slugs pass
 * through unchanged. Single source for the id→slug mapping so the canonical
 * `@id`, the emitted file path, and the fact-parity comparator stay consistent.
 */
export function canonicalEntitySlug(entityId: string): string {
  return entityId.split("/").filter(Boolean).pop() ?? entityId;
}

export function deriveCanonicalUri(
  siteOrigin: string | undefined,
  type: CanonicalEntityType,
  entityId?: string,
): string | undefined {
  if (!siteOrigin) return undefined;

  const base = siteOrigin.replace(/\/+$/, "");

  if (type === "business") {
    return `${base}/.well-known/entity/business.json`;
  }

  if (!entityId) return undefined;

  // Entity IDs are URIs (e.g. `https://warpgogol.com/id/offerings/automation`).
  // Embedding the raw URI into the path produces a malformed double-scheme URI
  // (`.../offering/https://warpgogol.com/...`) and a non-filesystem-safe path
  // (`path.join` collapses `//` → `/`, breaking the @id = served-path parity).
  const slug = canonicalEntitySlug(entityId);

  return `${base}/.well-known/entity/offering/${slug}.json`;
}
