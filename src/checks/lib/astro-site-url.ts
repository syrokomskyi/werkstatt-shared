/*
<MODULE_CONTRACT>
<purpose>Best-effort helper to read the canonical site URL from an app's astro.config.mjs.</purpose>
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

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Read canonical site URL from astro.config.mjs.
 * Best-effort regex — no AST parsing needed.
 * Handles JS expressions like `site: process.env.X || "https://example.com"`.
 */
export async function readAstroSiteUrl(appDir: string): Promise<string | undefined> {
  const configPath = join(appDir, "astro.config.mjs");
  try {
    const text = await readFile(configPath, "utf-8");
    const match = text.match(/site:.*?["'](https?:\/\/[^"']+)["']/);
    return match?.[1];
  } catch {
    return undefined;
  }
}
