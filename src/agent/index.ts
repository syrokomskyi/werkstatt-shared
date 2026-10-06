/*
<MODULE_CONTRACT>
<purpose>
RFC-0286: barrel for the Agent Surface shared model. Re-exports the framework-free
manifest contract + canonicalization primitives; RFC-0287..0291 add sibling modules
here (knowledge, capability, openapi, proof) and re-export them from this barrel.
</purpose>
<non-goals>
  <item>Do not add logic here — pure re-export barrel.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1112: re-export receipt module (ActionReceipt, AgentProblemDetails, deriveActionEventId).</item>
  <item>RFC-1172: closed agent.traffic telemetry — ports.telemetry sink, TrafficRecorder + boundary emit via withTrafficEmit</item>
  <item>RFC-1113: re-export skill-md module (per-domain SKILL.md projection for ARD agent-skills entries).</item>
  <item>RFC-1187: phases 1-3 — contracts, Redis registry, AS core + Bearer pipeline</item>
  <item>RFC-1188: Web Bot Auth outbound identity: wba-sign primitives, directory emit+sweep, AGS-WBA-01, leitstand signed fetches</item>
  <history>RFC-0286, RFC-0292, RFC-0783, RFC-0786, RFC-0954</history>
</CHANGE_SUMMARY>
*/

export * from "./manifest.ts";
export * from "./knowledge.ts";
export * from "./capability.ts";
export * from "./capability-schema.ts";
export * from "./openapi.ts";
export * from "./omit-empty.ts";
export * from "./proof.ts";
export * from "./telemetry.ts";
export * from "./fleet-catalog.ts";
export * from "./api-catalog.ts";
export * from "./mcp-card.ts";
export * from "./dns-aid.ts";
export * from "./ard-catalog.ts";
export * from "./skill-md.ts";
export * from "./search.ts";
export * from "./receipt.ts";
export * from "./guidance.ts";
export * from "./health.ts";
export * from "./registration.ts";
export * from "./agent-jwt.ts";
export * from "./wba-sign.ts";
