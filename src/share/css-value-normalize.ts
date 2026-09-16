/*
<MODULE_CONTRACT>
<purpose>
Canonical CSS value normalizer shared by biome.css.generate (codegen) and
biome.tokens.validate (drift detection). Whitespace collapsing, quote
normalisation, hex lowercasing, and trailing-zero stripping are applied in a
single deterministic order so that generated CSS and drift comparisons never
disagree on equality.
</purpose>
<non-goals>
  <item>Do not format CSS for emission — line-breaking is the caller's job.</item>
  <item>Do not parse CSS structure — this is a string-level transform only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

/**
 * Normalize a CSS value string for stable comparison and emission.
 *
 * Applies (in order):
 * 1. Whitespace collapse + trim (multi-line gradients become single-line)
 * 2. Parenthesis spacing removal
 * 3. Single → double quote conversion
 * 4. Hex color lowercasing
 * 5. Trailing decimal zero stripping
 */
export function normalizeCssValue(value: string): string {
  return (
    value
      // Collapse all whitespace runs (handles multi-line gradient formatting)
      .replace(/\s+/g, " ")
      .trim()
      // Remove spaces immediately after ( and before ) so gradient args align
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")")
      // CSS strings: double quotes
      .replace(/'([^']*)'/g, '"$1"')
      // Hex colors: lowercase
      .replace(/#([0-9A-Fa-f]+)/g, (_m, hex) => `#${hex.toLowerCase()}`)
      // Strip trailing decimal zeros (e.g. 20.40px → 20.4px, 1.10 → 1.1)
      .replace(/(\d+\.\d*[1-9])0+/g, "$1")
      // Strip redundant .0 suffix (e.g. 1.0 → 1, 0.0 → 0)
      .replace(/(\d+)\.0+(?!\d)/g, "$1")
  );
}
