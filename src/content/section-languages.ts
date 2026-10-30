/*
<MODULE_CONTRACT>
<purpose>
  RFC-1444 shared vocabulary and helpers for section-scoped alternate
  languages: the closed shell-label vocabulary, the resolved rendition model
  shape, the non-routed marker predicate, and heading demotion for stacked
  non-primary renditions.
</purpose>
<non-goals>
  <item>Do not read files — content resolution lives in werkstatt-site.</item>
  <item>Do not validate — SECTION-LANG-01..07 live in mirroring.validate.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1444: section-scoped alternate languages with a section-scoped switcher — supersedes RFC-1436.</item>
  <item>RFC-1444: replace companion renditions with section-scoped languages (RFC-1444)</item>
</CHANGE_SUMMARY>
*/

/**
 * RFC-1444 closed vocabulary (v1) of label keys shell components may pair
 * with a declared section language. `footer.*`/`header.*` keys read
 * `site/<lang>/labels.md` at the same dot path; `navigation.legal` pairs
 * every group-legal target in `navigation/<lang>/navigation.md`.
 * Extending the list requires a manifest change on the shell component.
 */
export const SECTION_LANGUAGE_SHELL_KEYS = [
  "footer.navGroups.navigationTitle",
  "footer.navGroups.legalTitle",
  "footer.navGroups.contactTitle",
  "footer.taglineLines",
  "header.motto",
  "navigation.legal",
] as const;

export type SectionLanguageShellKey = (typeof SECTION_LANGUAGE_SHELL_KEYS)[number];

const SECTION_LANGUAGE_SHELL_KEY_SET: ReadonlySet<string> = new Set(SECTION_LANGUAGE_SHELL_KEYS);

export function isSectionLanguageShellKey(key: string): key is SectionLanguageShellKey {
  return SECTION_LANGUAGE_SHELL_KEY_SET.has(key);
}

/**
 * One rendition of an opted-in block in a declared language. `props` carries
 * the per-language resolved props (block props, prose html under the
 * archetype's prose prop key); the primary rendition's props are the
 * page-locale block's own.
 */
export interface SectionLanguageRendition {
  lang: string;
  name: string;
  primary: boolean;
  props: Record<string, unknown>;
}

/**
 * The typed model the page builder resolves `blocks[].languages` into.
 * Renditions are ordered primary first, then declared order. Empty renditions
 * are never emitted — the builder omits the model instead.
 */
export interface SectionLanguagesModel {
  /** Layout variant: `switch` (client-toggled, non-primary hidden) or `stacked` (all visible). */
  layout: "switch" | "stacked";
  /** Switcher variant passed to lang-switcher scope:section. */
  switcherVariant: "pill" | "text";
  /** Renditions in axis order — primary (page locale) first. */
  renditions: SectionLanguageRendition[];
}

/**
 * RFC-1444 marker: `routed: false` is THE skip signal for collection loaders,
 * route generators, sitemap, llms and indexers — a non-routed partial tree
 * file. `lang` alone never skips.
 */
export function isNonRoutedFrontmatter(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { routed?: unknown }).routed === false
  );
}

/**
 * RFC-1444 AC-4: stacked non-primary renditions demote headings to styled
 * paragraphs so the document outline stays single-language — a non-primary
 * rendition never emits h1–h6. Idempotent; applied by the wrapper component.
 */
export function demoteSectionLanguageHeadings(html: string): string {
  return html.replace(
    /<h[1-6](?:\s[^>]*)?>([\s\S]*?)<\/h[1-6]>/g,
    '<p class="section-languages__heading">$1</p>',
  );
}
