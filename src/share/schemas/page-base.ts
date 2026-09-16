/*
<MODULE_CONTRACT>
<purpose>
Shared base Zod fields consumed by all page schemas across apps/*. Extracted to packages/share
so every app re-uses the same componentOverrides contract without copy-pasting.
Depends only on the zod peer dependency; no Astro or app-specific imports.
</purpose>
<non-goals>
  <item>Do not define page-specific or app-specific fields here.</item>
  <item>Do not import from apps/* or astro:content.</item>
  <item>Do not perform runtime data fetching or API interactions.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

// [RFC-0004] Shared base fields for all page schemas.
// Extracted to packages/share to prevent copy-paste across apps.
// Import z from "zod" — not "astro/zod" — so this package stays framework-neutral.

import { z } from "zod";

// componentOverrides: a map of component paths to partial content objects.
// Pages use this to override default component copy from frontmatter,
// keeping .astro route files thin and copy-free.
export const componentOverridesSchema = z
  .record(z.string(), z.record(z.string(), z.unknown()))
  .optional();

export type ComponentOverrides = z.infer<typeof componentOverridesSchema>;
