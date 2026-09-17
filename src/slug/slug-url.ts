/*
<MODULE_CONTRACT>
<purpose>slug-url — canonical locale-aware URL slug generation for site routes (RFC-0915, DNA-88).</purpose>
<non-goals>
  <item>Do not handle heading anchor deduplication — use HeadingSlugger for that.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0915: extracted from werkstatt-site/src/domain/geo/slug.ts as canonical URL slug function.</item>
  <item>RFC-1097: sweep — tail packages clean

Sweep batch 3: rewrote ~95 purposes across werkstatt-knowledge, werkstatt-shared, godot-game, phaser-game, lifecycle-core, projektarchiv-*, portal-*, billing-*, typescript (CONTRACT-02/PURPOSE-02). Real KEY_DECISIONS on 5 godot utils, non-goals on 5 CONTRACT-03 files, headers on 4 headerless files, CS-07 history literal fix on 2 files. Policy: vitest.config.ts + test-fixtures testPatterns, worker-configuration.d.ts excludedPath. All non-site/engine packages now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

import { resolveSlugStrategy } from "./strategies.ts";

/**
 * Generates a locale-aware Latin URL slug from text.
 * Uses German umlaut replacements for lang="de",
 * Cyrillic transliteration for lang="uk",
 * and default @sindresorhus/slugify for other/undefined langs.
 * Returns "entity" if the input produces an empty slug.
 */
export function slugUrl(text: string, lang?: string): string {
  return resolveSlugStrategy(lang).slug(text) || "entity";
}
