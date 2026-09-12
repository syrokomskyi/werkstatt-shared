/*
<MODULE_CONTRACT>
  <purpose>RFC-1075: derive persistent canonical URIs for PBP entity envelopes from site origin and entity identity. Used for Linked Data @id fields in JSON-LD and llms-full.txt projections.</purpose>
  <non-goals>
    <item>Does not validate that the entity ID is well-formed — callers are responsible for providing valid IDs.</item>
    <item>Does not perform URL normalization beyond trailing-slash removal on the site origin.</item>
  </non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1075: initial — deriveCanonicalUri pure function for persistent entity @id URIs.</item>
</CHANGE_SUMMARY>
*/

/**
 * Entity types supported by the PBP canonical URI scheme.
 *
 * The URI path pattern is `/.well-known/entity/{type}/{id}` for typed entities
 * (e.g. offerings) and `/.well-known/entity/business` for the single business entity.
 */
export type CanonicalEntityType = "business" | "offering";

/**
 * RFC-1075: derive a persistent canonical URI for a PBP entity.
 *
 * The URI follows the pattern:
 * - Business: `{siteOrigin}/.well-known/entity/business`
 * - Offering: `{siteOrigin}/.well-known/entity/offering/{entityId}`
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
export function deriveCanonicalUri(
  siteOrigin: string | undefined,
  type: CanonicalEntityType,
  entityId?: string,
): string | undefined {
  if (!siteOrigin) return undefined;

  const base = siteOrigin.replace(/\/+$/, "");

  if (type === "business") {
    return `${base}/.well-known/entity/business`;
  }

  if (!entityId) return undefined;

  return `${base}/.well-known/entity/offering/${entityId}`;
}
