/*
<MODULE_CONTRACT>
<purpose>inline-markdown — the RFC-1289 x-text format contract as pure string
projections: renderInlineMarkdown emits safe external anchors, inlineMarkdownToPlain
projects the same field to plain text (JSON-LD, meta descriptions, plain-text
surfaces). Single shared home so every consumer of an inline-markdown field
(e.g. people.bio) produces identical output.</purpose>
<non-goals>
  <item>Do not render block-level Markdown (headings, lists, code) — that is the prose pipeline's format: markdown contract.</item>
  <item>Do not resolve {price:…}/{amount:…} markers — marker capability is a separate x-text axis handled by price-marker.ts.</item>
  <item>Do not strip anchor tags from already-rendered HTML — input is the raw x-text field, not markup.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1289: extracted from people-section.astro renderBioParagraph; person-profile-component.astro applies the same renderer so bio no longer ships raw […](…) residue on profile pages.</item>
  <item>RFC-1289: moved from werkstatt-site domain/ui/utils to shared text — participant-json.ts (share/astro) needs the plain projection for JSON-LD descriptions and must not import the ui layer.</item>
</CHANGE_SUMMARY>
*/

const INLINE_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const INLINE_BOLD = /\*\*(.+?)\*\*/g;
const INLINE_ITALIC = /\*(.+?)\*/g;

/**
 * Escape HTML, then turn `[text](https://…)` into safe external anchors.
 * Field contract: x-text format `inline-markdown` (RFC-1289).
 */
export function renderInlineMarkdown(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(
    INLINE_LINK,
    (_m, label: string, href: string) =>
      `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  );
}

/**
 * Project inline-markdown to plain text: `[text](url)` → `text`, `**x**` → `x`,
 * `*x*` → `x`. For contexts consumed as literal strings — JSON-LD descriptions,
 * meta descriptions, llms projections — where markdown syntax is visible residue.
 */
export function inlineMarkdownToPlain(text: string): string {
  return text
    .replace(INLINE_LINK, "$1")
    .replace(INLINE_BOLD, "$1")
    .replace(INLINE_ITALIC, "$1");
}
