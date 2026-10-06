/*
<MODULE_CONTRACT>
<purpose>
RFC-1112: canonical agent-action receipt + RFC 9457 problem-details contracts.
One shape for both invocation surfaces (HTTP POST /api/agent/actions/{id} and
MCP tools/call) — the receipt is the final v1 answer; errors carry a stable
machine `code` so agents can branch without parsing prose.
</purpose>
<non-goals>
  <item>Do not store or transport lead payload fields — receipts carry
        identifiers and timestamps only (no PII at rest).</item>
  <item>Do not add transport logic — HTTP/MCP mapping lives in the engine
        (action-pipeline.ts, mcp/handler.ts).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1112: initial receipt/problem-details contracts + deterministic eventId derivation.</item>
  <item>RFC-1187: phases 1-3 — contracts, Redis registry, AS core + Bearer pipeline</item>
  <item>RFC-1187: fo-review — auth-backend-unavailable code (503 retryable) for registry outages on AS endpoints</item>
</CHANGE_SUMMARY>
*/

import { byteHash } from "@warpgogol/werkstatt-shared/fingerprint";

/**
 * The single response shape for a successful agent action invocation (RFC-1112).
 * `receiptId` equals `IntegrationEvent.eventId` — deterministic when the caller
 * supplied an Idempotency-Key, random otherwise.
 */
export interface ActionReceipt {
  receiptId: string;
  status: "accepted" | "duplicate";
  duplicate: boolean;
  /** ISO 8601 — stamped by the dispatch adapter at publish time. */
  submittedAt: string;
}

/** Stable machine codes for agent-action failures (RFC-1112). Closed set. */
export type AgentErrorCode =
  | "invalid-json"
  | "schema-violation"
  | "unknown-capability"
  | "payload-too-large"
  | "rate-limited"
  | "dispatch-failed"
  | "idempotency-key-reuse"
  | "unauthorized"
  | "invalid-challenge"
  | "invalid-proof"
  | "already-registered"
  | "oauth-unavailable"
  | "auth-backend-unavailable"
  | "presentation-required"
  | "presentation-invalid";

/** RFC 9457 problem details with platform extension members (`code`, `retryable`, …). */
export interface AgentProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code: AgentErrorCode;
  retryable: boolean;
  /** Per-field violations for schema-violation. */
  errors?: { path: string; message: string }[];
  /** Pointer into agent.openapi.json for schema-violation. */
  schemaRef?: string;
  /** Seconds until the rate-limit window resets (rate-limited only). */
  retryAfterSeconds?: number;
}

export const AGENT_ERROR_STATUS: Record<AgentErrorCode, number> = {
  "invalid-json": 400,
  "schema-violation": 422,
  "unknown-capability": 404,
  "payload-too-large": 413,
  "rate-limited": 429,
  "dispatch-failed": 502,
  "idempotency-key-reuse": 409,
  unauthorized: 401,
  "invalid-challenge": 400,
  "invalid-proof": 400,
  "already-registered": 409,
  "oauth-unavailable": 404,
  "auth-backend-unavailable": 503,
  "presentation-required": 403,
  "presentation-invalid": 403,
};

export const AGENT_ERROR_RETRYABLE: Record<AgentErrorCode, boolean> = {
  "invalid-json": false,
  "schema-violation": false,
  "unknown-capability": false,
  "payload-too-large": false,
  "rate-limited": true,
  "dispatch-failed": true,
  "idempotency-key-reuse": false,
  unauthorized: false,
  "invalid-challenge": false,
  "invalid-proof": false,
  "already-registered": false,
  "oauth-unavailable": false,
  "auth-backend-unavailable": true,
  "presentation-required": false,
  "presentation-invalid": false,
};

const AGENT_ERROR_TITLE: Record<AgentErrorCode, string> = {
  "invalid-json": "Request body is not valid JSON",
  "schema-violation": "Input failed schema validation",
  "unknown-capability": "Unknown capability",
  "payload-too-large": "Payload exceeds the capability limit",
  "rate-limited": "Rate limit exceeded",
  "dispatch-failed": "Delivery substrate rejected the event",
  "idempotency-key-reuse": "Idempotency-Key was used with a different payload",
  unauthorized: "Bearer authentication required",
  "invalid-challenge": "Registration challenge is unknown, expired, or already consumed",
  "invalid-proof": "Key proof signature did not verify",
  "already-registered": "Agent is already registered",
  "oauth-unavailable": "Authorization server is not configured on this site",
  "auth-backend-unavailable": "Authorization backend temporarily unavailable",
  "presentation-required": "A verifiable presentation is required for this capability",
  "presentation-invalid": "The verifiable presentation did not satisfy the requirement",
};

/** Build a problem-details object for `code`; status/title/retryable derive from the closed tables. */
export function buildAgentProblem(
  code: AgentErrorCode,
  init?: Partial<Omit<AgentProblemDetails, "type" | "status" | "code" | "retryable">>,
): AgentProblemDetails {
  return {
    type: "about:blank",
    title: AGENT_ERROR_TITLE[code],
    status: AGENT_ERROR_STATUS[code],
    code,
    retryable: AGENT_ERROR_RETRYABLE[code],
    ...(init?.detail !== undefined ? { detail: init.detail } : {}),
    ...(init?.errors !== undefined ? { errors: init.errors } : {}),
    ...(init?.schemaRef !== undefined ? { schemaRef: init.schemaRef } : {}),
    ...(init?.retryAfterSeconds !== undefined ? { retryAfterSeconds: init.retryAfterSeconds } : {}),
  };
}

/**
 * RFC-1112: deterministic eventId/receiptId from an Idempotency-Key.
 * sha256("gogol-agent-action:" + capabilityId + ":" + key), first 32 hex chars
 * formatted as a UUID. Same key + same capability → same eventId, so QStash
 * deduplication and the receipt store agree on identity.
 */
export function deriveActionEventId(capabilityId: string, idempotencyKey: string): string {
  const hex = byteHash(`gogol-agent-action:${capabilityId}:${idempotencyKey}`).slice(
    "sha256:".length,
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
