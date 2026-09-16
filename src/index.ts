/*
<MODULE_CONTRACT>
<purpose>Package index barrel for @warpgogol/werkstatt-shared — stack-agnostic shared infrastructure extracted from werkstatt-site (RFC-0868).</purpose>
<non-goals>
  <item>Do not export site-specific validators, Astro components, or stack plugin logic.</item>
  <item>Do not import from @warpgogol/werkstatt-site or any stack plugin.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0868: initial extraction from werkstatt-site.</item>
  <item>RFC-1097: sweep — tail packages clean

Sweep batch 3: rewrote ~95 purposes across werkstatt-knowledge, werkstatt-shared, godot-game, phaser-game, lifecycle-core, projektarchiv-*, portal-*, billing-*, typescript (CONTRACT-02/PURPOSE-02). Real KEY_DECISIONS on 5 godot utils, non-goals on 5 CONTRACT-03 files, headers on 4 headerless files, CS-07 history literal fix on 2 files. Policy: vitest.config.ts + test-fixtures testPatterns, worker-configuration.d.ts excludedPath. All non-site/engine packages now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

export * from "./checks/index.ts";
