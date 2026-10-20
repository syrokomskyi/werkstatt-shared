/*
<MODULE_CONTRACT>
<purpose>Canonical braceless `collection.file.field` reference pattern plus the
business-profile reference finder shared by content.references.validate, the
PUBGATE-01/02 validators (RFC-1283), and the RFC-1341 render-side below-public
scanner. Single source so every consumer parses references identically.</purpose>
<non-goals>
  <item>Do not resolve references — content-reference.ts owns resolution.</item>
  <item>Do not read files — pure string scanning.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1341: created — pattern/finder extracted from werkstatt-site checks/lib/pbp-publication.ts so the build-page stage can scan block props without importing checks code.</item>
  <item>RFC-1341: rfc-1341: code review r1 (pass, blockLevel none) + CHANGE_SUMMARY dedup</item>
</CHANGE_SUMMARY>
*/

/**
 * Braceless `collection.file.field` reference pattern, as a source string so
 * every consumer compiles its own RegExp instance (no shared `lastIndex`
 * state). Single source for content.references.validate, the PUBGATE-01
 * entity lookup, and the render-side below-public scan.
 */
export const BRACELESS_REFERENCE_PATTERN_SOURCE =
  "\\b([a-z][a-z-]*)\\.([a-z0-9-/]+)\\.([a-zA-Z0-9_.-]+)\\b";

/**
 * Returns every `business-profile.<entryId>.<field>` match in source order
 * with 1-based line numbers; the `file` segment becomes `entryId`.
 */
export function findBusinessProfileReferences(
  source: string,
): Array<{ entryId: string; raw: string; line: number }> {
  const results: Array<{ entryId: string; raw: string; line: number }> = [];
  const pattern = new RegExp(BRACELESS_REFERENCE_PATTERN_SOURCE, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    if (match[1] !== "business-profile") continue;
    let line = 1;
    for (let i = 0; i < match.index; i += 1) {
      if (source.charCodeAt(i) === 10) line += 1;
    }
    results.push({ entryId: match[2]!, raw: match[0], line });
  }
  return results;
}
