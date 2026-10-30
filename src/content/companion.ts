/*
<MODULE_CONTRACT>
<purpose>
  RFC-1436 shared vocabulary and helpers for the non-routed companion language:
  the closed shell-label vocabulary, the resolved rendition prop shape, the
  dual-marker predicate, and heading demotion for companion prose.
</purpose>
<non-goals>
  <item>Do not read files — content resolution lives in werkstatt-site.</item>
  <item>Do not validate — COMPANION-01..05 live in mirroring.validate.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1436: initial module — shell key vocabulary, CompanionRendition type, isCompanionFrontmatter, demoteCompanionHeadings.</item>
  <item>RFC-1436: companion-language renditions inside blocks and shell components</item>
</CHANGE_SUMMARY>
*/

/**
 * RFC-1436 closed vocabulary (v1) of label keys shell components may pair
 * with the companion language. `footer.*`/`header.*` keys read
 * `site/<companion>/labels.md` at the same dot path; `navigation.legal` pairs
 * every group-legal target in `navigation/<companion>/navigation.md`.
 * Extending the list requires a manifest change on the shell component.
 */
export const COMPANION_SHELL_KEYS = [
  "footer.navGroups.navigationTitle",
  "footer.navGroups.legalTitle",
  "footer.navGroups.contactTitle",
  "footer.taglineLines",
  "header.motto",
  "navigation.legal",
] as const;

export type CompanionShellKey = (typeof COMPANION_SHELL_KEYS)[number];

const COMPANION_SHELL_KEY_SET: ReadonlySet<string> = new Set(COMPANION_SHELL_KEYS);

export function isCompanionShellKey(key: string): key is CompanionShellKey {
  return COMPANION_SHELL_KEY_SET.has(key);
}

/**
 * The typed section prop the page builder resolves `blocks[].companion` into.
 * `html` is pre-rendered companion prose (prose mode); `props` is the
 * archetype-declared field subset (props mode). Empty renditions are never
 * emitted — the builder omits the prop instead.
 */
export interface CompanionRendition {
  lang: string;
  name: string;
  html?: string;
  props?: Record<string, string>;
}

/**
 * RFC-1436 dual marker: `companion: true` is THE skip signal for collection
 * loaders, route generators, sitemap, llms and indexers — `lang` alone never
 * skips. A file carrying only one marker is invalid (COMPANION-02 class).
 */
export function isCompanionFrontmatter(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as { companion?: unknown }).companion === true;
}

/**
 * RFC-1436 AC-2: companion prose headings demote to a styled paragraph so the
 * document outline stays single-language — a companion rendition never emits
 * h1–h6. Idempotent; applied both by the page-builder resolver and the
 * rendition component.
 */
export function demoteCompanionHeadings(html: string): string {
  return html.replace(
    /<h[1-6](?:\s[^>]*)?>([\s\S]*?)<\/h[1-6]>/g,
    '<p class="companion-rendition__heading">$1</p>',
  );
}
