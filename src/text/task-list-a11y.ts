/*
<MODULE_CONTRACT>
<purpose>
  [DEPLOY-BLOCK-2026-10-04] SSR HTML post-processor that hides read-only GFM
  task-list checkboxes from assistive technology. micromark-gfm and remark-gfm
  both emit `<li><input type="checkbox" disabled>` for `- [ ]` items — a form
  control without an accessible name (axe "label" → blocking finding). The
  checkbox is decorative: authored checklists are always-unchecked self-check
  prompts and the list item text carries the meaning, so the honest fix is
  `aria-hidden="true"`, not a synthetic label. Zero DOM access — safe to call
  in Astro SSR/SSG frontmatter.
</purpose>
<non-goals>
  <item>Do not import or call this from browser scripts — server-only.</item>
  <item>Do not restructure the list item or alter its visual rendering.</item>
  <item>Do not use a full HTML parser — keep dependency-free.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>DEPLOY-BLOCK-2026-10-04: created — hides disabled task-list checkboxes
    from AT. certify-dev failed on 68 axe `label` findings (ratgeber
    self-check lists on warpgogol): disabled inputs have no accessible name
    and are unreachable via `astro.config` (generated) on the Astro render()
    path, so all emit points post-process their HTML with this helper.</item>
</CHANGE_SUMMARY>
*/

// @ai-invariant: Server-only. Never import in browser scripts.

const INPUT_TAG_RE = /<input\b[^>]*>/g;
const CHECKBOX_TYPE_RE = /\btype=["']checkbox["']/;
const DISABLED_RE = /\bdisabled\b/;
const ARIA_HIDDEN_RE = /\baria-hidden\b/;
const TAG_END_RE = /\s*\/?>$/;

/**
 * Adds `aria-hidden="true"` to disabled checkbox inputs (GFM task-list items).
 * Enabled checkboxes, non-checkbox inputs, and already-hidden inputs pass
 * through unchanged. Idempotent.
 */
export function applyTaskListA11y(html: string): string {
  return html.replace(INPUT_TAG_RE, (tag) => {
    if (!CHECKBOX_TYPE_RE.test(tag) || !DISABLED_RE.test(tag) || ARIA_HIDDEN_RE.test(tag)) {
      return tag;
    }
    const end = tag.match(TAG_END_RE)?.[0] ?? ">";
    return `${tag.slice(0, -end.length)} aria-hidden="true"${end}`;
  });
}
