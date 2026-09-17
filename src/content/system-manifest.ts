/*
<MODULE_CONTRACT>
<purpose>Facilitates loading and parsing of the canonical system.md manifest per RFC-0047.
Stack-agnostic utility used by both engine and site plugin (RFC-0868).</purpose>
<non-goals>
  <item>Do not validate system manifest content (handled by validators).</item>
  <item>Do not handle system manifest generation or modification.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0868: extracted from werkstatt-site/src/content/system-manifest.ts.</item>
  <item>RFC-0911: add seo?.anchorText?.extraStopPhrases for anchor-text stop-list extension.</item>
  <item>RFC-1106: step 3 — sole SystemManifest definition, loaders parse()

Delete the hand-written SystemManifest interface; content/system-manifest.ts re-exports the schema-inferred type. Both loaders switch from 'as unknown as' to systemManifestSchema.parse() — the schema now executes at load. system.manifest.validate catches ZodError and maps issues into structured diagnostics; the post-load safeParse was dead code. Zero consumer breaks: all growth/release/tagline readers were already optional-safe. New adjacent test pins parse-at-load (AC-7).</item>
</CHANGE_SUMMARY>
*/

import { readFile, access } from "node:fs/promises";
import { readFileSync, accessSync } from "node:fs";
import { join } from "node:path";
import { parseMarkdownFrontmatter } from "./markdown-frontmatter.ts";
import { systemManifestSchema } from "../ontology/schemas/system/manifest.ts";
import type { SystemManifest } from "../ontology/schemas/system/manifest.ts";

// RFC-1106: systemManifestSchema is the sole SystemManifest definition.
// The inferred output type materializes .default()s (pages, constellations,
// clientEditable, retiredRoutes, planets stay non-optional) and keeps
// growth/release/tagline optional — the old interface lied about those.
export type { SystemManifest };

export interface SystemManifestLoadResult {
  manifest: SystemManifest;
  source: "system.md";
  filePath: string;
}

/**
 * Loads and parses the canonical system.md manifest from src/content/system.md.
 *
 * @param contentDirectory The src/content directory path
 * @returns Parsed system manifest with source information
 */
export async function loadSystemManifest(
  contentDirectory: string,
): Promise<SystemManifestLoadResult> {
  const systemMdPath = join(contentDirectory, "system.md");
  await access(systemMdPath);
  const content = await readFile(systemMdPath, "utf8");
  const parsed = parseMarkdownFrontmatter(content);

  return {
    manifest: systemManifestSchema.parse(parsed.data),
    source: "system.md",
    filePath: systemMdPath,
  };
}

/**
 * Synchronous version of loadSystemManifest for contexts where async is not available.
 *
 * @param contentDirectory The src/content directory path
 * @returns Parsed system manifest with source information
 */
export function loadSystemManifestSync(contentDirectory: string): SystemManifestLoadResult {
  const systemMdPath = join(contentDirectory, "system.md");
  accessSync(systemMdPath);
  const content = readFileSync(systemMdPath, "utf8");
  const parsed = parseMarkdownFrontmatter(content);

  return {
    manifest: systemManifestSchema.parse(parsed.data),
    source: "system.md",
    filePath: systemMdPath,
  };
}

/**
 * Checks if the canonical system.md manifest exists.
 *
 * @param contentDirectory The src/content directory path
 * @returns true if src/content/system.md exists
 */
export async function isUsingSystemMd(contentDirectory: string): Promise<boolean> {
  const systemMdPath = join(contentDirectory, "system.md");
  try {
    await access(systemMdPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronous version of isUsingSystemMd.
 *
 * @param contentDirectory The src/content directory path
 * @returns true if src/content/system.md exists
 */
export function isUsingSystemMdSync(contentDirectory: string): boolean {
  const systemMdPath = join(contentDirectory, "system.md");
  try {
    accessSync(systemMdPath);
    return true;
  } catch {
    return false;
  }
}
