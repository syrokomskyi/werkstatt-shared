/*
<MODULE_CONTRACT>
  <purpose>Barrel export for @warpgogol/werkstatt-shared/component sub-path. Re-exports component contract types (ComponentId, CapabilityId, EffectClass, IsolationTier, ComponentDeclaration) sunk from @warpgogol/werkstatt-engine per RFC-1104.</purpose>
  <non-goals>Does not re-export engine component-runtime modules (identity, schemas, runtime registry).</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1104: initial barrel — component contracts sunk from werkstatt-engine.</item>
</CHANGE_SUMMARY>
*/

export * from "./contracts.ts";
