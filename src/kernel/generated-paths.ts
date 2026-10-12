/*
<MODULE_CONTRACT>
<purpose>
Shared reader + write-guard verdict for the generated-path registry
`.werkstatt/generated-paths.generated.yaml` (RFC-1262). The registry is
materialized per site by `generated.paths.generate` (build.prepare) as the
union of command `generates[]` declarations, RFC-0081 marker headers, and
`.gitattributes` linguist-generated marks. Consumed by both engine
(workpiece.write) and site (content.* ops) — keeping one reader prevents two
divergent ownership projections.
</purpose>
<non-goals>
  <item>Do not derive ownership — the site-side derivation module consumes buildGeneratorOwnership (RFC-0960).</item>
  <item>Do not fail closed when the registry is absent — absence means "inert" (GENW-02 advisory).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1260: shared generated-path registry reader for the write guards</item>
  <item>RFC-1262: contract shape (`paths`, `sources`, `generatedAt`, `modulePath`) with legacy `entries`/`generatedBy` read-compat; added generatedWriteGuard verdict shared by workpiece.write and content ops.</item>
  <history>RFC-1260, RFC-1262</history>
</CHANGE_SUMMARY>
*/

import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import picomatch from "picomatch";
import { createDefaultIO, type WorkspaceIO } from "./workspace-io.ts";

export const GENERATED_PATHS_REGISTRY = ".werkstatt/generated-paths.generated.yaml";
export const GENERATED_PATHS_REGISTRY_VERSION = 1;

export type GeneratedPathSource = "command-generates" | "file-marker" | "gitattributes";

export interface GeneratedPathEntry {
  /** Site-relative glob (e.g. "src/content/pages/de/cosmic/passport.md"). */
  path: string;
  /** Owning generator command name (e.g. "overlay.pages.generate"). */
  owner: string;
  /** Derivation sources that contributed this entry (RFC-1262 union). */
  sources?: GeneratedPathSource[];
  /** Marker-file escape hatch — editable entries are not guarded (RFC-1153). */
  editable?: boolean;
  /** Generator source module — feeds the sanctioned-edit hint. */
  modulePath?: string;
}

export interface GeneratedPathRegistry {
  version: number;
  generatedAt?: string;
  paths: GeneratedPathEntry[];
}

/**
 * Loads the registry for a site directory. Returns null when absent or
 * unreadable — the guard stays fail-open until `generated.paths.generate`
 * materializes the file. Reads the RFC-1262 `paths` shape; legacy `entries`
 * arrays (with `owner`/`generatedBy`) normalize into the same structure.
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
      generatedAt?: unknown;
      paths?: unknown;
      entries?: unknown;
    } | null;
    if (!parsed) return null;
    const raw = Array.isArray(parsed.paths)
      ? parsed.paths
      : Array.isArray(parsed.entries)
        ? parsed.entries
        : null;
    if (!raw) return null;
    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : undefined,
      paths: raw
        .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
        .filter((e) => typeof e.path === "string")
        .map((e) => ({
          path: e.path as string,
          owner:
            typeof e.owner === "string"
              ? e.owner
              : typeof e.generatedBy === "string"
                ? e.generatedBy
                : "unknown",
          sources: Array.isArray(e.sources)
            ? e.sources.filter((s): s is GeneratedPathSource => typeof s === "string")
            : undefined,
          editable: e.editable === true,
          modulePath: typeof e.modulePath === "string" ? e.modulePath : undefined,
        })),
    };
  } catch {
    return null;
  }
}

/**
 * Returns the matching non-editable entry when `relPath` (posix, site-relative)
 * is covered by the registry, else undefined.
 */
export function generatedPathEntry(
  registry: GeneratedPathRegistry | null,
  relPath: string,
  opts?: { includeEditable?: boolean },
): GeneratedPathEntry | undefined {
  if (!registry) return undefined;
  for (const entry of registry.paths) {
    if (entry.editable === true && !opts?.includeEditable) continue;
    if (picomatch.isMatch(relPath, entry.path, { dot: true })) return entry;
  }
  return undefined;
}

/**
 * Returns the owning generator when `relPath` is covered by a non-editable
 * registry entry, else undefined.
 */
export function generatedPathOwner(
  registry: GeneratedPathRegistry | null,
  relPath: string,
): string | undefined {
  return generatedPathEntry(registry, relPath)?.owner;
}

export interface GeneratedWriteVerdict {
  allowed: boolean;
  owner?: string;
  /**
   * Sanctioned edit path (GENW-01): where the durable change belongs —
   * the generator template/source — plus the regenerate command.
   */
  hint?: string;
}

/**
 * GENW-01 verdict shared by `workpiece.write` and the RFC-1260 content-op
 * pipeline (aliased there as COPS-03). Editable entries pass; a missing
 * registry fails open (absence is advisory-only under the GENW-02 rollout).
 */
export function generatedWriteGuard(
  registry: GeneratedPathRegistry | null,
  relPath: string,
): GeneratedWriteVerdict {
  const entry = generatedPathEntry(registry, relPath);
  if (!entry) return { allowed: true };
  const editInstead = entry.modulePath
    ? `Edit the template in ${entry.modulePath} and re-run 'pnpm exec werkstatt run ${entry.owner}'.`
    : entry.owner === "unknown"
      ? "Edit the owning generator's source or the file's declared input, then regenerate."
      : `Edit the generator source and re-run 'pnpm exec werkstatt run ${entry.owner}'.`;
  return {
    allowed: false,
    owner: entry.owner,
    hint: `${editInstead} Direct edits are overwritten on the next build.`,
  };
}
