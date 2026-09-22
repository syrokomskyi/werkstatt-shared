/*
<MODULE_CONTRACT>
  <purpose>Barrel export for @warpgogol/werkstatt-shared/kernel sub-path. Re-exports the kernel contract cluster (command/pipeline types, workspace IO, atomic fs, desired state, diagnostic schemas) sunk from @warpgogol/werkstatt-engine per RFC-1104.</purpose>
  <non-goals>
    <item>Does not re-export engine runtime modules (executor, module registry, CLI).</item>
  </non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1104: initial barrel — kernel contract cluster sunk from werkstatt-engine.</item>
  <item>RFC-1126: step 1 — shared contracts (drift guard + workpiece env)

Add guardTrackedOverwrite (json/yaml/text lost-key diff, warn-by-default, --strict fail-hard) and loadWorkpieceEnv (dotenv.parse wrapper) to werkstatt-shared kernel subpath; extend KernelRuntimeContext with optional workpieceEnv field.</item>
</CHANGE_SUMMARY>
*/

export * from "./types.ts";
export * from "./workspace-io.ts";
export * from "./fs-atomic.ts";
export * from "./desired-state.ts";
export * from "./diagnostic.ts";
export * from "./drift-guard.ts";
export * from "./workpiece-env.ts";
