/*
<MODULE_CONTRACT>
<purpose>Barrel export for the entire semantic layer: models, extractors, IDs, JSON-LD, LLMs projections, page builders, and utilities.</purpose>
<non-goals>
  <item>Do not contain implementation logic — this is a barrel file only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

export * from "./models.ts";
export * from "./breadcrumbs.ts";
export * from "./extract.ts";
export * from "./ids.ts";
export * from "./jsonld.ts";
export * from "./markdown-hygiene.ts";
export * from "./llms.ts";
export * from "./llms-policy.ts";
export * from "./output-projection.ts";
export * from "./business-projection.ts";
export * from "./organization-profile.ts";
export * from "./ai.ts";
export * from "./robots.ts";
export * from "./page-utils.ts";
export * from "./page-markdown.ts";
export * from "./feed.ts";
export * from "./image-sitemap.ts";
export * from "./page-builders/markdown-page.ts";
export * from "./build-page.ts";
export * from "./block-extraction.ts";
export * from "./block-extractors/index.ts";
export * from "./update-stamp.ts";
export * from "./markdown-twin-provenance.ts";
export * from "./price-marker-resolver.ts";
export * from "./canonical-uri.ts";
export * from "./fact-extraction.ts";
export * from "./freshness.ts";
