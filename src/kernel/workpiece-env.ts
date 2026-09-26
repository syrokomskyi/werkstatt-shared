/*
<MODULE_CONTRACT>
<purpose>
RFC-1126: lazy .env loader for the resolved site workspace. The kernel CLI loads
dotenv from process.cwd() (the workshop root) only — a workpiece .env is invisible
to pipeline commands unless each command implements its own fallback (the m000075
readWorkpieceEnv pattern). This module generalizes that fallback once: the executor
populates KernelRuntimeContext.workpieceEnv from <context.site.directory>/.env.
</purpose>
<non-goals>
  <item>Does not override process.env — real environment always wins; this map is a fallback only.</item>
  <item>Does not implement a general .env hierarchy (shell profiles, CI secrets) — only the resolved-site .env.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>dotenv.parse is reused (already a kernel dependency) instead of a hand-rolled regex parser.</item>
  <item>Node-only module (node:fs) — kernel-subpath export only, never re-exported from client-reachable barrels.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1126: initial implementation — loadWorkpieceEnv + EMPTY_WORKPIECE_ENV.</item>
  <item>RFC-1126: step 1 — shared contracts (drift guard + workpiece env)

Add guardTrackedOverwrite (json/yaml/text lost-key diff, warn-by-default, --strict fail-hard) and loadWorkpieceEnv (dotenv.parse wrapper) to werkstatt-shared kernel subpath; extend KernelRuntimeContext with optional workpieceEnv field.</item>
</CHANGE_SUMMARY>
*/

import { join } from "node:path";
import { parse as dotenvParse } from "dotenv";
import { createDefaultIO, type WorkspaceIO } from "@warpgogol/werkstatt-shared/kernel/workspace-io";

/** Shared empty map for contexts without a resolved site or .env file. */
export const EMPTY_WORKPIECE_ENV: ReadonlyMap<string, string> = new Map();

/**
 * Parse `<siteDirectory>/.env` into a ReadonlyMap. Returns an empty map when
 * the site is undefined or the file is missing/unreadable — never throws.
 */
export async function loadWorkpieceEnv(
  siteDirectory: string | undefined,
  io: WorkspaceIO = createDefaultIO().io,
): Promise<ReadonlyMap<string, string>> {
  if (!siteDirectory) return EMPTY_WORKPIECE_ENV;
  try {
    const raw = await io.readFile(join(siteDirectory, ".env"));
    return new Map(Object.entries(dotenvParse(raw)));
  } catch {
    return EMPTY_WORKPIECE_ENV;
  }
}
