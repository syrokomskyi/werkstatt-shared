/*
<MODULE_CONTRACT>
<purpose>
[RFC-1196] Single resolver for section heading-id derivation — both call sites
(section-header `uniqueId`, section-shell `aria-labelledby`) MUST consume it so
the labelled-by ↔ id pair can never diverge. Fallback chain: non-empty
`sectionNumber` wins, else `sectionId` (the per-block anchor id, RFC-0914),
else the bare type-derived id.
</purpose>
<non-goals>
  <item>Do not resolve anchors or read SectionProps — callers pass resolved values.</item>
  <item>Do not generate or validate block ids — BlockEntrySchema owns that contract (RFC-0914).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1196: created — falsy sectionNumber fallback to sectionId fixes duplicate type-derived heading ids on unnumbered sections.</item>
  <item>RFC-1196: step 1 — sectionHeadingId() resolver + sectionId prop</item>
</CHANGE_SUMMARY>
*/

/**
 * Derive the unique DOM id for a section heading.
 *
 * @param typeId - Type-derived base id authored by the section (e.g. "markdown-section-title").
 * @param sectionNumber - Zero-padded index resolved by blocks-renderer; "" when the section is unnumbered.
 * @param sectionId - Per-instance anchor id resolved via resolveSectionAnchor (= blockId, RFC-0914).
 * @returns `{prefix}-{typeId}` when a non-empty prefix exists, else `typeId` unchanged.
 *
 * `sectionNumber` is compared with `||`, never `??`: blocks-renderer emits ""
 * for unnumbered blocks and `"" ?? x` would produce a leading-dash id.
 */
export function sectionHeadingId(
  typeId: string | undefined,
  sectionNumber: string | undefined,
  sectionId: string | undefined,
): string | undefined {
  const prefix = sectionNumber || sectionId;
  return typeId && prefix ? `${prefix}-${typeId}` : typeId;
}
