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
  <item>RFC-0292: re-export fleet-catalog module.</item>
  <item>RFC-0783: re-export api-catalog and mcp-card modules.</item>
  <item>RFC-0786: re-export dns-aid module.</item>
  <item>RFC-0954: re-export search module.</item>
  <item>RFC-1112: re-export receipt module (ActionReceipt, AgentProblemDetails, deriveActionEventId).</item>
  <history>RFC-0286</history>
</CHANGE_SUMMARY>
*/

export * from "./manifest.ts";
export * from "./knowledge.ts";
export * from "./capability.ts";
export * from "./openapi.ts";
export * from "./omit-empty.ts";
export * from "./proof.ts";
export * from "./fleet-catalog.ts";
export * from "./api-catalog.ts";
export * from "./mcp-card.ts";
export * from "./dns-aid.ts";
export * from "./ard-catalog.ts";
export * from "./search.ts";
export * from "./receipt.ts";
export * from "./guidance.ts";
export * from "./health.ts";
