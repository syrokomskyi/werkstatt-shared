/*
<MODULE_CONTRACT>
<purpose>
Shared reader for the generated-path registry `.werkstatt/generated-paths.generated.yaml`
(RFC-1260 write-guard, materialized by RFC-1262). Consumed by both engine
(workpiece.write) and site (content.* ops) — keeping one reader prevents two
divergent ownership projections.
</purpose>
<non-goals>
  <item>Do not derive ownership — buildGeneratorOwnership (RFC-0960) owns derivation.</item>
  <item>Do not fail closed when the registry is absent — absence means "inert".</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1260: shared generated-path registry reader for the write guards</item>
  <item>RFC-1260</item>
</CHANGE_SUMMARY>
*/

import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import picomatch from "picomatch";
import { createDefaultIO, type WorkspaceIO } from "./workspace-io.ts";

export const GENERATED_PATHS_REGISTRY = ".werkstatt/generated-paths.generated.yaml";

export interface GeneratedPathEntry {
  /** Site-relative glob (e.g. "src/content/pages/de/cosmic/passport.md"). */
  path: string;
  /** Owning generator command name (e.g. "overlay.pages.generate"). */
  owner: string;
  /** Marker-file escape hatch — editable registries entries are not guarded. */
  editable?: boolean;
}

export interface GeneratedPathRegistry {
  version: number;
  entries: GeneratedPathEntry[];
}

/**
 * Loads the registry for a site directory. Returns null when absent or
 * unreadable — the guard stays inert until RFC-1262 emits the file.
 */
export async function loadGeneratedPathRegistry(
  siteDir: string,
  io: WorkspaceIO = createDefaultIO().io,
): Promise<GeneratedPathRegistry | null> {
  const registryPath = join(siteDir, GENERATED_PATHS_REGISTRY);
  try {
    if (!(await io.exists(registryPath))) return null;
    const parsed = parseYaml(await io.readFile(registryPath)) as {
      version?: number;
      entries?: Array<{ path?: unknown; owner?: unknown; generatedBy?: unknown; editable?: unknown }>;
    } | null;
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      entries: parsed.entries
        .filter((e) => typeof e?.path === "string")
        .map((e) => ({
          path: e.path as string,
          owner:
            typeof e.owner === "string"
              ? e.owner
              : typeof e.generatedBy === "string"
                ? e.generatedBy
                : "unknown",
          editable: e.editable === true,
        })),
    };
  } catch {
    return null;
  }
}

/**
 * Returns the owning generator when `relPath` (posix, site-relative) is covered
 * by a non-editable registry entry, else undefined.
 */
export function generatedPathOwner(
  registry: GeneratedPathRegistry | null,
  relPath: string,
): string | undefined {
  if (!registry) return undefined;
  for (const entry of registry.entries) {
    if (entry.editable === true) continue;
    if (picomatch.isMatch(relPath, entry.path, { dot: true })) return entry.owner;
  }
  return undefined;
}
