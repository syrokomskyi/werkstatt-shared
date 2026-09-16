/*
<MODULE_CONTRACT>
<purpose>i18n helpers for check validators — read the default language code from a site system.md frontmatter.</purpose>
<non-goals>
  <item>Do not load translation catalogs — this module only resolves the default language code.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: sweep — tail packages clean

Sweep batch 3: rewrote ~95 purposes across werkstatt-knowledge, werkstatt-shared, godot-game, phaser-game, lifecycle-core, projektarchiv-*, portal-*, billing-*, typescript (CONTRACT-02/PURPOSE-02). Real KEY_DECISIONS on 5 godot utils, non-goals on 5 CONTRACT-03 files, headers on 4 headerless files, CS-07 history literal fix on 2 files. Policy: vitest.config.ts + test-fixtures testPatterns, worker-configuration.d.ts excludedPath. All non-site/engine packages now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";

function parseFrontmatter(source: string): { data: Record<string, unknown> } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {} };
  const data = parseYaml(match[1]) as Record<string, unknown>;
  return { data };
}

export async function readDefaultLanguageCode(contentRoot: string): Promise<string> {
  const systemPath = join(contentRoot, "system.md");
  const raw = await readFile(systemPath, "utf-8");
  const { data } = parseFrontmatter(raw);
  const i18n = (data as Record<string, unknown>).i18n as { default?: unknown } | undefined;
  if (typeof i18n?.default === "string" && i18n.default.trim() !== "") {
    return i18n.default.trim();
  }
  throw new Error("[i18n] src/content/system.md must declare i18n.default.");
}

export function defaultLanguageFromManifest(manifest: { i18n?: unknown }): string {
  const i18n = manifest.i18n as { default?: unknown } | undefined;
  const defaultLanguage = i18n?.default;
  if (typeof defaultLanguage === "string" && defaultLanguage.trim() !== "") {
    return defaultLanguage.trim();
  }
  throw new Error("[i18n] manifest must declare i18n.default.");
}
