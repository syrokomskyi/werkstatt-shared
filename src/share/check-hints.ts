/*
<MODULE_CONTRACT>
<purpose>Warpgogol check hints schema and parser: defines the hint configuration shape for check-warpgogol runs.</purpose>
<non-goals>
  <item>Do not introduce app-specific runtime composition or deployment behavior into this reusable package source file.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

export const warpgogolCheckHintsSchema = z.object({
  schemaVersion: z.literal(1),
  siteId: z.string().min(1),
  baseUrl: z.string().url().optional(),
  languages: z.object({
    default: z.string().min(1),
    supported: z.array(z.string().min(1)).min(1),
  }),
  preferredStartPaths: z.array(z.string().startsWith("/")),
  sectionAnchors: z.array(
    z.object({
      path: z.string().startsWith("/"),
      sectionId: z.string().min(1),
      label: z.string().optional(),
    }),
  ),
  audienceProfiles: z.array(z.string().min(1)),
});

export type WarpgogolCheckHints = z.infer<typeof warpgogolCheckHintsSchema>;

export function parseWarpgogolCheckHints(value: unknown): WarpgogolCheckHints {
  return warpgogolCheckHintsSchema.parse(value);
}
