/*
<MODULE_CONTRACT>
<purpose>
RFC-1187: contracts for the agent registration tier — the persisted
registration record, the storage port (Upstash Redis REST adapter satisfies
it), the key-proof verifier port (the astro adapter supplies the network
fetch), and the token-side verified-identity shape. Pure types + interfaces —
no fetch, no Redis client, no key material here.
</purpose>
<non-goals>
  <item>Do not implement storage — the adapter lives in integration/agent-registry.ts.</item>
  <item>Do not implement signature verification — the verifier impl lives in the engine gate.</item>
  <item>Do not define route shapes — the gate handlers own request/response schemas.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1187: initial agent registration contracts (registry, verifier, verified identity).</item>
  <item>RFC-1187: phases 1-3 — contracts, Redis registry, AS core + Bearer pipeline</item>
</CHANGE_SUMMARY>
*/

/**
 * Persisted registration. `credentialSecretHash` is a sha256 hex of the
 * issued secret — plaintext is returned to the registrant once and NEVER
 * stored (enhance decision: hash-only persistence).
 */
export interface AgentRegistration {
  /** Stable identity — `agent-<sha256(signatureAgent)[:16]>`, derived, never chosen. */
  agentId: string;
  /** https URL of the agent's HTTP-message-signatures key directory (JWKS). */
  signatureAgent: string;
  /** sha256 hex of the current credential secret. */
  credentialSecretHash: string;
  /** Granted scopes (e.g. ["actions:elevated","registration:self"]). */
  scopes: string[];
  /** ISO 8601 first-registration timestamp. */
  registeredAt: string;
  /** Monotonically increasing — bumped on rotate; tokens carry it implicitly via secret validity. */
  credentialVersion: number;
  /** ISO 8601 revocation timestamp — present only while the registration is dead. */
  revokedAt?: string;
}

/**
 * Registration storage port — satisfied by `restRedisAgentRegistry`
 * (integration/agent-registry.ts) over the Upstash Redis EU REST endpoint.
 * All methods throw on transport error; callers decide fail-open semantics.
 */
export interface AgentRegistrationRegistry {
  /** Fetch a registration by id; null when absent. Revoked records are still returned — the caller checks `revokedAt`. */
  get(agentId: string): Promise<AgentRegistration | null>;
  /** Upsert a registration (create or rotate-rewrite). */
  put(registration: AgentRegistration): Promise<void>;
  /**
   * Issue a single-use challenge nonce (SET with TTL). The register endpoint
   * consumes it via `consumeChallenge` — a nonce verifies at most once.
   */
  putChallenge(nonce: string, ttlSeconds: number): Promise<void>;
  /** Atomically consume a challenge (GETDEL semantics). True iff the nonce existed and was unconsumed. */
  consumeChallenge(nonce: string): Promise<boolean>;
  /** All registrations — operator `agent.registration.list`. */
  list(): Promise<AgentRegistration[]>;
}

/**
 * Registration proof submitted by the registrant: `signature` is the agent's
 * Ed25519 signature over the UTF-8 bytes of `challenge`, verifiable against a
 * key from the JWKS document at `signatureAgent`.
 */
export interface AgentKeyProof {
  signatureAgent: string;
  /** base64url Ed25519 signature over the challenge bytes. */
  signature: string;
  /** Server-issued, single-use nonce. */
  challenge: string;
  /** Optional key id — narrows verification to one JWK in the directory. */
  kid?: string;
}

/**
 * Key-proof verifier port. The concrete impl lives at the Worker boundary
 * (engine astro.ts) — it performs the signatureAgent JWKS fetch under the
 * RFC-1187 SSRF guards (https-only, redirect/size/timeout caps). The gate
 * core sees only this narrow surface, keeping it pure and vitest-loadable.
 */
export interface AgentRegistrationVerifier {
  /** Returns the derived agentId when the proof verifies; null otherwise. */
  verify(proof: AgentKeyProof): Promise<{ agentId: string } | null>;
}

/** The resolved identity of a verified Bearer token — stamped into the action pipeline. */
export interface VerifiedAgent {
  agentId: string;
  scopes: string[];
}

/** Scopes the site issues — closed vocabulary, extended only by RFC. */
export const AGENT_SCOPE_ACTIONS_ELEVATED = "actions:elevated" as const;
export const AGENT_SCOPE_REGISTRATION_SELF = "registration:self" as const;

/** Derive the stable agentId from the registration's identity key material. */
export function deriveAgentId(
  signatureAgent: string,
  sha256Hex: (input: string) => string,
): string {
  return `agent-${sha256Hex(signatureAgent).slice(0, 16)}`;
}
