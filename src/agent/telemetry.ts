/*
<MODULE_CONTRACT>
<purpose>
RFC-1172: closed schema for the `werkstatt.agent.traffic` telemetry event —
one structured JSON line per agent-gate request, emitted through the gate's
`telemetry` port (production adapters wire it to Workers logs). The schema is
strict: unknown fields fail validation, so payload content can never creep in
(DNA-19, DNA-58).
</purpose>
<non-goals>
  <item>Do not add request/response payload fields — protocol metadata only (RFC-1172).</item>
  <item>Do not emit events here — the emit helper lives in werkstatt-engine's agent-gate.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1172: initial closed telemetry event schema.</item>
  <item>RFC-1172: closed agent.traffic telemetry — ports.telemetry sink, TrafficRecorder + boundary emit via withTrafficEmit</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

/** Closed agent traffic event — emitted once per gate request (RFC-1172). */
export const agentTrafficEventSchema = z
  .object({
    type: z.literal("werkstatt.agent.traffic"),
    /** ISO 8601 emission timestamp. */
    timestamp: z.string(),
    /** Sternsystem id — `AgentSurfaceManifest.site`. */
    systemId: z.string(),
    protocol: z.enum(["http", "mcp", "a2a", "nlweb"]),
    /**
     * Closed operation token. `other` covers gate operations the pinned enum
     * does not name — MCP `server/discover`/`ping`/`resources/list`/`initialize`,
     * unknown JSON-RPC methods, method-rejected requests — the raw method name
     * travels in `capability`. Extending this enum requires an RFC (DNA-19).
     */
    operation: z.enum([
      "tools/list",
      "tools/call",
      "action.call",
      "knowledge.get",
      "search",
      "ask",
      "health",
      "other",
    ]),
    /** Action/tool id for `action.call` / `tools/call`. */
    capability: z.string().optional(),
    /**
     * `rejected` = pre-handler gate rejection (malformed request, unknown
     * operation, missing entitlement); `failure` = handler-emitted problem or
     * exception on a processed request.
     */
    status: z.enum(["success", "failure", "rate-limited", "rejected"]),
    /** RFC 9457 `type` token when the terminal path is a problem. */
    problemKind: z.string().optional(),
    /** RFC-1112: idempotent replay served from a stored receipt. */
    duplicate: z.boolean().optional(),
    /** Negotiated MCP protocol version (RFC-1113) — MCP requests only. */
    mcpProtocolVersion: z.string().optional(),
    /** RFC-0291 identity headers, exactly as observed — never trusted. */
    observedIdentity: z.record(z.string(), z.string()).optional(),
    /** Gate processing time in integer milliseconds. */
    durationMs: z.number().int().nonnegative(),
  })
  .strict();

export type AgentTrafficEvent = z.infer<typeof agentTrafficEventSchema>;
