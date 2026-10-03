/*
<MODULE_CONTRACT>
<purpose>
RFC-1187: minimal EdDSA JWS (JWT) sign/verify for the worker-hosted agent
authorization server. Compact serialization `b64u(header).b64u(payload).b64u(sig)`,
alg fixed to "EdDSA" — no "none", no algorithm agility. The site passport
Ed25519 key signs tokens (one identity); resource-side verification needs only
the public key. Hand-rolled over @noble/ed25519 primitives — no JWT dependency.
</purpose>
<non-goals>
  <item>Do not implement JWK parsing or key loading — callers supply raw keys.</item>
  <item>Do not implement claims beyond RFC-1187's contract (iss/sub/iat/exp/scope/jti).</item>
  <item>Do not support other algorithms — alg is closed, by design.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1187: initial EdDSA JWT primitives for the agent authorization server.</item>
  <item>RFC-1187: phases 1-3 — contracts, Redis registry, AS core + Bearer pipeline</item>
  <item>RFC-1187: phases 5-7 — OAuth route/discovery generators, env schema, operator commands</item>
</CHANGE_SUMMARY>
*/

import { signBytes, verifyBytes } from "../signing/sign.ts";

/** RFC-1187: access-token claim contract issued by the agent authorization server. */
export interface AgentTokenClaims {
  /** Site origin, e.g. "https://warpgogol.com" — also the resource's expected issuer. */
  iss: string;
  /** Registered agent id (sub = agent identity). */
  sub: string;
  /** Issued-at, unix seconds. */
  iat: number;
  /** Expiry, unix seconds — MUST be at most iat + 3600. */
  exp: number;
  /** Space-delimited granted scopes (e.g. "agent.actions.elevated agent.registration"). */
  scope?: string;
  /** Unique token id for audit/traceability. */
  jti?: string;
}

export const AGENT_TOKEN_MAX_TTL_SECONDS = 3600;

const JWT_HEADER = { alg: "EdDSA", typ: "JWT" } as const;

/** base64url encode (no padding) — UTF-8 for strings. */
export function b64uEncode(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  return Buffer.from(bytes)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** base64url decode — accepts the unpadded form JWS emits. */
export function b64uDecode(input: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) return null;
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  return new Uint8Array(Buffer.from(padded.replaceAll("-", "+").replaceAll("_", "/"), "base64"));
}

/** Sign claims into a compact EdDSA JWT. `exp - iat` MUST NOT exceed 3600s. */
export async function signAgentToken(
  claims: AgentTokenClaims,
  privateKey: Uint8Array,
): Promise<string> {
  if (claims.exp - claims.iat > AGENT_TOKEN_MAX_TTL_SECONDS) {
    throw new Error(`AGENT-TOKEN-TTL: exp - iat exceeds ${AGENT_TOKEN_MAX_TTL_SECONDS}s`);
  }
  const signingInput = `${b64uEncode(JSON.stringify(JWT_HEADER))}.${b64uEncode(
    JSON.stringify(claims),
  )}`;
  const signature = await signBytes(privateKey, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64uEncode(signature)}`;
}

export type AgentTokenVerifyFailure =
  "malformed" | "header" | "signature" | "claims" | "expired" | "issuer";

export type AgentTokenVerifyResult =
  { ok: true; claims: AgentTokenClaims } | { ok: false; reason: AgentTokenVerifyFailure };

/**
 * Verify a compact EdDSA JWT: signature over the signing input, fixed
 * `alg: "EdDSA"` header (no "none" downgrade), `exp` not elapsed, `iss` equals
 * the expected issuer. Returns a discriminated failure — callers map every
 * failure to the same 401; the reason is for logs only.
 */
export async function verifyAgentToken(
  token: string,
  publicKey: Uint8Array,
  expectedIssuer: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<AgentTokenVerifyResult> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [headerB64, payloadB64, signatureB64] = parts;

  const headerBytes = b64uDecode(headerB64);
  if (!headerBytes) return { ok: false, reason: "header" };
  try {
    const header = JSON.parse(new TextDecoder().decode(headerBytes)) as { alg?: unknown };
    if (header.alg !== "EdDSA") return { ok: false, reason: "header" };
  } catch {
    return { ok: false, reason: "header" };
  }

  const signature = b64uDecode(signatureB64);
  if (!signature || signature.length !== 64) return { ok: false, reason: "signature" };
  const signingInput = `${headerB64}.${payloadB64}`;
  const valid = await verifyBytes(publicKey, new TextEncoder().encode(signingInput), signature);
  if (!valid) return { ok: false, reason: "signature" };

  const payloadBytes = b64uDecode(payloadB64);
  if (!payloadBytes) return { ok: false, reason: "claims" };
  let claims: AgentTokenClaims;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as Record<string, unknown>;
    if (
      typeof parsed.iss !== "string" ||
      typeof parsed.sub !== "string" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return { ok: false, reason: "claims" };
    }
    claims = parsed as unknown as AgentTokenClaims;
  } catch {
    return { ok: false, reason: "claims" };
  }

  if (claims.exp <= nowSeconds) return { ok: false, reason: "expired" };
  if (claims.iss !== expectedIssuer) return { ok: false, reason: "issuer" };
  return { ok: true, claims };
}
