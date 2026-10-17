/*
<MODULE_CONTRACT>
<purpose>Public entrypoint for @warpgogol/werkstatt-shared/onboarding — exports
the intake contract, capability-gap model, PBP layout and onboarding YAML helpers.</purpose>
<non-goals>
  <item>Do not import from app-specific packages or stack plugins.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1281: intake contract and onboarding.intake.validate</item>
  <item>RFC-1299: capability.brief + family.detect + capability.gap.validate</item>
  <item>RFC-1307: step 1 — shared PBP layout map, canonical writer, typed onboarding state</item>
  <item>RFC-1307: step 5 — remove 00-brief.md path, onboarding.synthesize and brief.validate; cold run registers from intake</item>
  <item>RFC-1317: step 1 — onboarding-decision Zod contract + parity test</item>
  <history>RFC-0868</history>
</CHANGE_SUMMARY>
*/

export * from "./capability-gap.ts";
export * from "./intake.ts";
export * from "./onboarding-decision.ts";
export * from "./pbp-layout.ts";
export * from "./yaml.ts";
