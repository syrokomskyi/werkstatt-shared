/*
<MODULE_CONTRACT>
<purpose>walkFiles — the single file-discovery and file-reading seam for stack plugins
(RFC-1100). Returns workspace-relative paths with forward slashes and reads file
contents in bulk, so validators never import node:fs directly.</purpose>

<non-goals>
  <item>Does not write files — writes flow through writeFileIfChanged / WorkspaceIO.</item>
  <item>Does not apply implicit ignore rules (no dotfile or prefix skipping) — callers scope by directory and filter.</item>
  <item>Does not run in the browser — server-only (Node fs/promises).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1100: initial shared walker — walkFiles plus readTextFile/readTextFiles/readBinaryFiles companions; replaces per-validator private readdir walkers in stack plugins.</item>
  <item>RFC-1100: step 1 — shared tool/fs/check seams (walkFiles, runTool, defineStackChecks)</item>
</CHANGE_SUMMARY>
*/

// Server-only. Do not import from browser/client scripts.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface WalkFilesOptions {
  /** Recurse into subdirectories. Default true. */
  recursive?: boolean;
  /** Return true to include a file by its directory-relative path (forward slashes). */
  filter?: (relPath: string) => boolean;
}

/**
 * Lists files under `dir` as relative paths with forward slashes.
 * Missing or unreadable directories yield an empty array.
 */
export async function walkFiles(
  dir: string,
  options: WalkFilesOptions = {},
): Promise<string[]> {
  const { recursive = true, filter } = options;
  const results: string[] = [];

  async function walk(current: string, relPrefix: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (recursive) {
          await walk(join(current, entry.name), relPath);
        }
        continue;
      }
      if (!entry.isFile()) continue;
      if (filter && !filter(relPath)) continue;
      results.push(relPath);
    }
  }

  await walk(dir, "");
  return results;
}

/**
 * Reads a single file as utf-8. Returns null when the file is missing or unreadable.
 */
export async function readTextFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Reads multiple files under `dir` as utf-8, keyed by their walkFiles-relative path.
 * Unreadable entries are omitted from the result.
 */
export async function readTextFiles(
  dir: string,
  relPaths: string[],
): Promise<Map<string, string>> {
  const contents = new Map<string, string>();
  for (const relPath of relPaths) {
    const content = await readTextFile(join(dir, relPath));
    if (content !== null) {
      contents.set(relPath, content);
    }
  }
  return contents;
}

/**
 * Reads multiple files under `dir` as raw buffers, keyed by their walkFiles-relative
 * path. Use for byte-accurate work (hashing, gzip measurement) where utf-8 decoding
 * would corrupt binary content. Unreadable entries are omitted from the result.
 */
export async function readBinaryFiles(
  dir: string,
  relPaths: string[],
): Promise<Map<string, Buffer>> {
  const contents = new Map<string, Buffer>();
  for (const relPath of relPaths) {
    try {
      contents.set(relPath, await readFile(join(dir, relPath)));
    } catch {
      // Skip unreadable files — same tolerance as the walkers this replaces.
    }
  }
  return contents;
}
