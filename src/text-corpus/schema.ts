/*
<MODULE_CONTRACT>
<purpose>
  RFC-1290: rendered-text corpus contract. `text.corpus.generate` (werkstatt-site)
  parses every dist/client HTML page with parse5 and emits a deterministic list of
  visible-text segments (title, headings, body text, list items, buttons, labels,
  alt/aria-label/placeholder/title attributes) per route+lang; `release.prepare`
  (werkstatt-engine) copies the corpus into release evidence and verifies its
  htmlTreeHash against the staged dist. Text rules (CORPUS-*, TERM-*, GRAM-*)
  consume this artifact instead of re-parsing dist.
</purpose>
<non-goals>
  <item>No language/terminology rules — RFC-1291/RFC-1292 layer those onto text.corpus.validate.</item>
  <item>No browser-rendered text — the corpus is parsed from static HTML only.</item>
  <item>No timestamps or run ids — the corpus is a pure function of dist HTML bytes (DNA-58).</item>
</non-goals>
<key-decisions>
  <item>htmlTreeHash covers EVERY dist/client html file including noindex pages and
  redirect stubs — it attests the input set, so staleness detection stays strong.</item>
  <item>Segments key on (route, lang, kind, path) — deterministic element paths make
  release-to-release diffs stable.</item>
</key-decisions>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1290: initial — corpusSegment/CorpusPage/TextCorpus schemas + computeHtmlTreeHash shared by site generator and engine release gate.</item>
  <item>RFC-1290</item>
  <item>RFC-1290: rendered-text corpus + release text diff</item>
  <item>RFC-1450: gate rendered text for locale leaks and internal identifiers (RFC-1450)</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";
import { byteHash } from "../fingerprint/primitives.ts";

export const corpusSegmentKindSchema = z.enum([
  "title",
  "meta-description",
  "heading",
  "text",
  "list-item",
  "button",
  "label",
  "alt",
  "aria-label",
  "placeholder",
  "title-attr",
]);
export type CorpusSegmentKind = z.infer<typeof corpusSegmentKindSchema>;

export const corpusSegmentSchema = z
  .object({
    kind: corpusSegmentKindSchema,
    /** Whitespace-collapsed, entity-decoded, trimmed visible text. */
    text: z.string().min(1),
    /** Element path, e.g. "main>section[data-slug=price-card]>ul>li:3>span". */
    path: z.string().min(1),
    /** Nearest ancestor element carrying data-slug. */
    section: z.string().optional(),
    /**
     * RFC-1450: nearest ancestor `lang` attribute — recorded only when it
     * differs from the page language, so foreign-language islands are
     * distinguishable from unmarked text.
     */
    lang: z.string().min(2).optional(),
  })
  .strict();
export type CorpusSegment = z.infer<typeof corpusSegmentSchema>;

export const corpusPageSchema = z
  .object({
    route: z.string().startsWith("/"),
    lang: z.string().min(2),
    /** dist/client-relative file path. */
    file: z.string(),
    segments: z.array(corpusSegmentSchema),
  })
  .strict();
export type CorpusPage = z.infer<typeof corpusPageSchema>;

export const textCorpusSchema = z
  .object({
    schema: z.literal("werkstatt/text-corpus@1"),
    systemId: z.string(),
    htmlTreeHash: z.string().startsWith("sha256:"),
    pages: z.array(corpusPageSchema),
  })
  .strict();
export type TextCorpus = z.infer<typeof textCorpusSchema>;

/**
 * sha256 over sorted "relpath\0sha256(content)\n" lines of every
 * dist/client html file. Shared by the site generator and the engine's
 * release.prepare so both compute the same value (RFC-1290).
 */
export function computeHtmlTreeHash(files: Array<{ relPath: string; content: string }>): string {
  const lines = files
    .map((f) => `${f.relPath}\0${byteHash(f.content)}`)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return byteHash(lines.join("\n") + (lines.length > 0 ? "\n" : ""));
}
