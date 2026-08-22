/*
<MODULE_CONTRACT>
<purpose>
RFC-0917 canonical placeholder route template filter. Detects Astro dynamic
route templates (e.g. `[slug]`, `[version]`) that are expanded by dedicated
route generators, not actual pages. All system.md consumers MUST import this
utility instead of reimplementing the bracket-detection check inline.
</purpose>
<non-goals>
  <item>Do not expand or resolve placeholder templates — only detect them.</item>
  <item>Do not validate route syntax — bracket presence is the only signal.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0917: Initial creation — centralize placeholder route template filtering.</item>
</CHANGE_SUMMARY>
*/

/**
 * Returns `true` if any route value in the given routes map contains
 * `[` or `]` characters, indicating an Astro dynamic route template
 * (e.g. `nachweis/[slug]`, `verify/[version]`).
 *
 * Returns `false` for `undefined`, `null`, or empty routes — safe default
 * that avoids false positives when routes are missing or not yet resolved.
 *
 * Canonical utility (RFC-0917, DNA-88 extension). All `system.md` consumers
 * MUST import from `@warpgogol/werkstatt-shared/share/routes/template-filter`.
 * Enforcement: `utility.provenance.validate` (RFC-0916).
 */
export function hasPlaceholderRoutes(routes?: Record<string, string> | null): boolean {
  if (!routes) return false;
  return Object.values(routes).some(
    (slug) => typeof slug === "string" && (slug.includes("[") || slug.includes("]")),
  );
}
