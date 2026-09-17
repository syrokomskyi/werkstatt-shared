/*
<MODULE_CONTRACT>
  <purpose>Barrel export for @warpgogol/werkstatt-shared/kernel sub-path. Re-exports the kernel contract cluster (command/pipeline types, workspace IO, atomic fs, desired state, diagnostic schemas) sunk from @warpgogol/werkstatt-engine per RFC-1104.</purpose>
  <non-goals>Does not re-export engine runtime modules (executor, module registry, CLI).</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1104: initial barrel — kernel contract cluster sunk from werkstatt-engine.</item>
</CHANGE_SUMMARY>
*/

export * from "./types.ts";
export * from "./workspace-io.ts";
export * from "./fs-atomic.ts";
export * from "./desired-state.ts";
export * from "./diagnostic.ts";
