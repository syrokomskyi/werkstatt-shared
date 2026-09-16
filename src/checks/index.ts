/*
<MODULE_CONTRACT>
<purpose>Shared checks index barrel for @warpgogol/werkstatt-shared — exports diagnosticsResult, suppressions, i18n, and astro-site-url helpers (RFC-0868).</purpose>
<non-goals>
  <item>Do not export site-specific validators or pipeline definitions.</item>
  <item>Do not import from @warpgogol/werkstatt-site or any stack plugin.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0868: extracted from werkstatt-site/src/checks as shared infrastructure.</item>
  <item>RFC-1097: sweep — tail packages clean

Sweep batch 3: rewrote ~95 purposes across werkstatt-knowledge, werkstatt-shared, godot-game, phaser-game, lifecycle-core, projektarchiv-*, portal-*, billing-*, typescript (CONTRACT-02/PURPOSE-02). Real KEY_DECISIONS on 5 godot utils, non-goals on 5 CONTRACT-03 files, headers on 4 headerless files, CS-07 history literal fix on 2 files. Policy: vitest.config.ts + test-fixtures testPatterns, worker-configuration.d.ts excludedPath. All non-site/engine packages now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

export {
  diagnosticsResult,
  passResult,
  failResult,
  resultFromViolations,
  formatCounts,
} from "./result-helpers.ts";

export * from "./suppressions-config.ts";

export { readAstroSiteUrl } from "./lib/astro-site-url.ts";
export { readDefaultLanguageCode } from "./lib/i18n.ts";
