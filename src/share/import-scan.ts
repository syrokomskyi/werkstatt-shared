/*
<MODULE_CONTRACT>
<purpose>Shared utility for scanning TypeScript source files for import specifiers
matching a pattern. Used by werkstatt.autonomy.validate, werkstatt.shared.validate,
and forge.autonomy.validate to avoid code duplication (Fowler: Duplicated Code).</purpose>

<non-goals>
  <item>Does not define what is forbidden or exempt — callers provide the pattern and filter.</item>
  <item>Does not scan test files — .test.ts and .spec.ts are always excluded.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0868: extract shared directory-scanning utility from autonomy-validate and shared-validate.</item>
  <item>RFC-0940: move to @warpgogol/werkstatt-shared so forge can import without depending on @warpgogol/werkstatt-engine.</item>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

export interface ImportViolation {
  file: string;
  specifier: string;
}

const EXCLUDE_DIRS = new Set(["node_modules", "tests", "tests-handoff", "dist", "templates"]);
const EXCLUDE_SUFFIXES = [".test.ts", ".spec.ts"];

const IMPORT_PATTERN =
  /(?:^|\n)\s*(?:import\s+(?:type\s+)?[^;]+?\s+from\s+|require\s*\(\s*)["'`]([^"'`]+)["'`]/g;

function shouldExcludeFile(fileName: string): boolean {
  return EXCLUDE_SUFFIXES.some((suffix) => fileName.endsWith(suffix));
}

export async function scanDirectoryForImports(
  dir: string,
  workspaceRoot: string,
  specifierFilter: (specifier: string) => boolean,
): Promise<{ violations: ImportViolation[]; scannedFiles: number }> {
  let scannedFiles = 0;
  const violations: ImportViolation[] = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const subResult = await scanDirectoryForImports(fullPath, workspaceRoot, specifierFilter);
      scannedFiles += subResult.scannedFiles;
      violations.push(...subResult.violations);
    } else if (entry.name.endsWith(".ts") && !shouldExcludeFile(entry.name)) {
      scannedFiles++;
      const content = await readFile(fullPath, "utf8").catch(() => "");
      let match: RegExpExecArray | null;
      const pattern = new RegExp(IMPORT_PATTERN.source, "g");
      while ((match = pattern.exec(content)) !== null) {
        const specifier = match[1]!;
        if (specifierFilter(specifier)) {
          violations.push({
            file: relative(workspaceRoot, fullPath),
            specifier,
          });
        }
      }
    }
  }

  return { violations, scannedFiles };
}
