/*
<MODULE_CONTRACT>
  <purpose>Barrel export for @warpgogol/werkstatt-shared/kernel sub-path. Re-exports the kernel contract cluster (command/pipeline types, workspace IO, atomic fs, desired state, diagnostic schemas) sunk from @warpgogol/werkstatt-engine per RFC-1104.</purpose>
  <non-goals>
    <item>Does not re-export engine runtime modules (executor, module registry, CLI).</item>
  </non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1126: step 1 — shared contracts (drift guard + workpiece env)

Add guardTrackedOverwrite (json/yaml/text lost-key diff, warn-by-default, --strict fail-hard) and loadWorkpieceEnv (dotenv.parse wrapper) to werkstatt-shared kernel subpath; extend KernelRuntimeContext with optional workpieceEnv field.</item>
  <item>RFC-1296</item>
  <item>RFC-1305: export capDiagnostics/capStrings + TRUNC_RULE_ID — shared truncation-marker primitives</item>
  <item>RFC-1334: steps 1-3 — shared structural reachability, reachableVia in the command manifest, coverage validator on the shared scan</item>
  <item>RFC-1463: composite gates report complete violation sets and self-ensure prerequisites — ensure/compositeGate metadata, executor ensure runner, blockedBy skip tracking, ENSURE-01..04 + GATE-CMP-01, runCompositeGate</item>
  <history>RFC-1104</history>
</CHANGE_SUMMARY>
*/

export * from "./types.ts";
export * from "./composite-gate.ts";
export * from "./workspace-io.ts";
export * from "./run-mutating.ts";
export * from "./command-source-scan.ts";
export * from "./command-reachability.ts";
export * from "./fs-atomic.ts";
export * from "./desired-state.ts";
export * from "./diagnostic.ts";
export * from "./diagnostic-cap.ts";
export * from "./diagnostics-summary.ts";
export * from "./drift-guard.ts";
export * from "./workpiece-env.ts";
export * from "./validation-baseline.ts";
