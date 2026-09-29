/*
<MODULE_CONTRACT>
<purpose>
RFC-1116: contracts for the agent surface health endpoint and the external
contract check. AgentHealth is the runtime response of GET /api/agent/health;
AgentContractCheckResult is the diagnostics payload of the
agent.surface.contract.check kernel command. The probe-id union is the closed
vocabulary both sides share — the route emits "health", the command emits the
full golden-journey list.
</purpose>
<non-goals>
  <item>Do not implement probe logic here — the command lives in
        @warpgogol/werkstatt-site/checks, the route factory in
        @warpgogol/werkstatt-engine/agent-gate.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1116: initial contracts — AgentHealth, AgentContractCheckResult, AgentContractProbeId.</item>
  <item>RFC-1169: AgentPreviewCheckId + previewChecks on the check result — readiness evidence fails closed on old-shape (422) surfaces.</item>
  <item>RFC-1171: AgentDeprecationCheck + deprecationChecks on the check result — per-deprecation alias header/successor evidence.</item>
</CHANGE_SUMMARY>
*/

/** Response of GET /api/agent/health (RFC-1116). */
export interface AgentHealth {
  status: "ok" | "degraded";
  /** AGENT_SURFACE_VERSION constant. */
  surfaceVersion: string;
  /** distTreeHash self-fetched from /.well-known/build-identity.json; "" when unavailable. */
  contentHash: string;
  checks: {
    manifest: "ok" | "missing";
    knowledge: "ok" | "missing";
    /** QStash publish token present? */
    dispatch: "configured" | "unconfigured";
    search: "available" | "unavailable";
  };
}

/**
 * Closed probe-id vocabulary for the golden journey (RFC-1116). The command
 * derives the active subset from the deployed agent.json — capabilities absent
 * from the manifest yield `skipped` probes, not failures.
 */
export type AgentContractProbeId =
  | "discovery.agent-json"
  | "discovery.api-catalog"
  | "discovery.llms"
  | "knowledge.fetch"
  | "mcp.initialize"
  | "mcp.tools-list"
  | "action.lead-prepare"
  | "action.error-shape"
  | "health";

export interface AgentContractProbe {
  id: AgentContractProbeId;
  ok: boolean;
  /** Capability absent from deployed agent.json, or agent.enabled: false. */
  skipped?: boolean;
  detail?: string;
}

/**
 * RFC-1169: closed readiness-check vocabulary. Two entries per check run —
 * the complete-input path (ready:true + summary + nextAction linkage) and the
 * incomplete-input path (200 ready:false + missing, never a 422). Kept out of
 * AgentContractProbeId so the golden-journey union stays untouched.
 */
export type AgentPreviewCheckId = "preview.ready" | "preview.incomplete";

export interface AgentPreviewCheck {
  id: AgentPreviewCheckId;
  ok: boolean;
  /** lead.prepare absent from the deployed manifest, or agent.enabled: false. */
  skipped?: boolean;
  detail?: string;
}

/**
 * RFC-1171: closed deprecation-check vocabulary. One entry per manifest
 * deprecations[] item: alias must carry Deprecation/Sunset/Link headers and
 * the successor must resolve; an alias still declared past sunsetAt fails.
 */
export type AgentDeprecationCheckId =
  "deprecation.headers" | "deprecation.successor" | "deprecation.sunset";

export interface AgentDeprecationCheck {
  id: AgentDeprecationCheckId;
  /** The deprecations[].path this entry covers. */
  path: string;
  ok: boolean;
  /** No deprecations[] in the deployed manifest, or agent.enabled: false. */
  skipped?: boolean;
  detail?: string;
}

/** Diagnostics payload of agent.surface.contract.check (RFC-1116, DNA-82). */
export interface AgentContractCheckResult {
  command: "agent.surface.contract.check";
  status: "pass" | "fail";
  url: string;
  probes: AgentContractProbe[];
  /** RFC-1169: preview readiness evidence — fails closed on old-shape surfaces. */
  previewChecks: AgentPreviewCheck[];
  /** RFC-1171: per-deprecation alias/successor evidence — fails closed when a declared alias lacks headers or the successor is dead. */
  deprecationChecks: AgentDeprecationCheck[];
}
