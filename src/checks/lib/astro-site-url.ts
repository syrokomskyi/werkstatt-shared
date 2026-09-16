/*
<MODULE_CONTRACT>
<purpose>Best-effort helper to read the canonical site URL from an app's astro.config.mjs.</purpose>
<non-goals>
  <item>Do not introduce app-specific runtime composition or deployment behavior into this reusable package source file.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into <history>, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
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
