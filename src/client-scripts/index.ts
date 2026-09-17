/* 
<MODULE_CONTRACT> 
<purpose>scripts index — central export point for the script modules used in dynamic loading contexts.</purpose> 
 
 
<non-goals> 
<item>Do not define new modules or components.</item> 
<item>Do not manage application state or business logic.</item> 
</non-goals> 
</MODULE_CONTRACT> 
 
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — tail packages clean

Sweep batch 3: rewrote ~95 purposes across werkstatt-knowledge, werkstatt-shared, godot-game, phaser-game, lifecycle-core, projektarchiv-*, portal-*, billing-*, typescript (CONTRACT-02/PURPOSE-02). Real KEY_DECISIONS on 5 godot utils, non-goals on 5 CONTRACT-03 files, headers on 4 headerless files, CS-07 history literal fix on 2 files. Policy: vitest.config.ts + test-fixtures testPatterns, worker-configuration.d.ts excludedPath. All non-site/engine packages now 0 diagnostics.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY> 
*/

// scheduler.ts is loaded dynamically by orchestrator.ts and lordicon.ts
export * from "./lordicon.ts";
export * from "./external-links.ts";
export * from "./external-link-qr.ts";
export * from "./lenis.ts";
export * from "./scroll-spy.ts";
export * from "./orchestrator.ts";
// gsap-counter.ts (RFC-0040) is loaded dynamically by orchestrator.ts
// inline-number-animation.ts (RFC-0041) is loaded dynamically by orchestrator.ts
// gsap-reveal.ts / gsap-parallax.ts / gsap-stagger.ts (RFC-0106) are loaded
// dynamically by orchestrator.ts via the reveal / parallax / stagger opt-ins.
