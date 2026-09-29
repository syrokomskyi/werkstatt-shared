/*
<MODULE_CONTRACT>
<purpose>
RFC-0286: the Agent Surface Manifest — the single generated artifact every
protocol projection (knowledge files, OpenAPI, MCP) derives from (AS-1). Pure,
deterministic assembly: no I/O, no timestamps, sorted-key canonical hashing so
two runs on unchanged input are byte-identical (AS-7).
</purpose>
<non-goals>
  <item>Do not read files or content — callers (kernel commands) load and pass data.</item>
  <item>Do not sign — proof is always null here; RFC-0308 adds signing over the
        domain-separated content hash payload via agent.surface.sign.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1113: add $schema, generatedAt (excluded from contentHash), supportedProtocols; AgentProtocol closed vocabulary.</item>
  <item>RFC-1113: align agent discovery surface with RFC 9727 and MCP 2026-07-28 stateless era</item>
  <item>RFC-1114: add "a2a" to AgentProtocol and interfaces.a2a (url + protocolVersion).</item>
  <item>RFC-1114: minimal real A2A endpoint + honest agent card</item>
  <item>RFC-1115: search results flattened to citation shape (title, canonicalUrl, updatedAt, lang, type, score, text) under the existing 2.0.0 surface; capability agentGuidance rendered into tool/operation descriptions.</item>
  <item>RFC-1165: add "nlweb" to AgentProtocol and conditional interfaces.nlweb (populated iff the SSR/search interface chain serves — static sites never advertise it).</item>
  <history>RFC-0286, RFC-0954, RFC-1076, RFC-1112</history>
</CHANGE_SUMMARY>
*/

import { createHash } from "node:crypto";
import type { AgentSurfaceProof } from "./proof.ts";

/** Semver of THIS manifest schema. Bump only via an RFC amending RFC-0286 (AS-7). */
export const AGENT_SURFACE_VERSION = "2.0.0";

/** RFC-1113: $schema identifier for the Agent Surface Manifest document. */
export const AGENT_SURFACE_SCHEMA_ID = "gogol.agent.surface/2";

/**
 * RFC-1113: closed vocabulary for AgentSurfaceManifest.supportedProtocols.
 * Every value MUST correspond to a discovery artifact or interface the surface
 * actually emits — agent.surface.validate enforces the honesty invariant
 * (AGS-DISCOVERY-01).
 */
export type AgentProtocol =
  | "mcp"
  | "a2a"
  | "openapi"
  | "linkset"
  | "llms"
  | "twins"
  | "ard"
  | "dns-aid"
  | "agent-skills"
  | "schemamap"
  | "nlweb"
  | "search";

export interface AgentKnowledgeRef {
  /** A BusinessDomain with visibility "public" (RFC-0287). */
  domain: string;
  url: string;
  /** e.g. "gogol.agent.knowledge/offer@1". */
  schema: string;
}

export interface AgentActionRef {
  /** Capability catalog id, e.g. "lead.submit" (RFC-0288). */
  id: string;
  url: string;
  title: Record<string, string>;
  inputSchemaRef: string;
  entitlement: "agent.actions";
  /**
   * RFC-1169: "none" marks a preview capability (validation failures answer
   * 200 ready:false, no dispatch). Optional — manifests deployed before
   * RFC-1169 lack it; absent reads as "write".
   */
  sideEffect?: "write" | "none";
}

export interface AgentClaimRef {
  id: string;
  claimClass: string;
  statement: string;
  verificationLevel?: string;
  evidenceCount: number;
}

export interface AgentSurfaceManifest {
  /** RFC-1113: schema identifier — "gogol.agent.surface/2". */
  $schema: string;
  surfaceVersion: string;
  site: string;
  baseUrl: string;
  languages: { default: string; supported: string[] };
  /** RFC-1113: ISO 8601 build timestamp — excluded from contentHash + signing payload. */
  generatedAt: string;
  /** RFC-1113: closed vocabulary — only the protocols this surface actually emits. */
  supportedProtocols: AgentProtocol[];
  /** sha256 hex over sorted-key JSON of this document minus contentHash + proof + generatedAt. */
  contentHash: string;
  knowledge: AgentKnowledgeRef[];
  actions: AgentActionRef[];
  /** RFC-1076: claim provenance chain — claims with their evidence references. */
  claims: AgentClaimRef[];
  interfaces: {
    llms: string;
    /** RFC-1164: the per-page JSON-LD mirror index — unconditional on an enabled
     *  surface (same precedent as `llms`: the surface pipeline always emits
     *  schemamap.xml; SMAP-03 verifies the artifact shipped). */
    schemamap: string;
    twins: { pattern: string } | null;
    openapi: string | null;
    mcp: { url: string; protocolVersion: string } | null;
    /** RFC-1114: the A2A endpoint — null when the surface ships no A2A route. */
    a2a: { url: string; protocolVersion: string } | null;
    search: { url: string; model: string; dimensions: number } | null;
    /** RFC-1165: the NLWeb /ask endpoint — populated iff `search` is (the SSR
     *  adapter + search-manifest chain gates both; static sites ship no /ask). */
    nlweb: string | null;
  };
  /** Null until agent.surface.sign signs it (RFC-0308) or when no key material exists. */
  proof: AgentSurfaceProof | null;
}

export interface AgentSurfaceManifestInput {
  site: string;
  baseUrl: string;
  languages: { default: string; supported: string[] };
  /** RFC-1113: ISO 8601 build timestamp supplied by the caller (the builder stays pure). */
  generatedAt: string;
  knowledge?: AgentKnowledgeRef[];
  actions?: AgentActionRef[];
  /** RFC-1076: claim provenance summaries for the manifest. */
  claims?: AgentClaimRef[];
  hasTwins?: boolean;
  openapiUrl?: string | null;
  mcp?: { url: string; protocolVersion: string } | null;
  /** RFC-1114: the A2A endpoint descriptor — omit/null when no A2A route exists. */
  a2a?: { url: string; protocolVersion: string } | null;
  search?: { url: string; model: string; dimensions: number } | null;
  /** RFC-1165: NLWeb /ask path — set when the search interface chain serves. */
  nlweb?: string | null;
}

// ---------------------------------------------------------------------------
// Canonicalization — shared by hashing here and by signing in RFC-0308
// ---------------------------------------------------------------------------

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Deterministic sorted-key JSON serialization — no whitespace, stable key order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

/**
 * sha256 hex over the canonical JSON of `doc` with `contentHash`, `proof`, and any
 * additional `excludeFields` removed. All signed manifest hash functions MUST use
 * this helper to ensure the `proof` field is always excluded — a missing exclusion
 * causes contentHash drift after signing (AGS-SEARCH-07 pattern).
 */
export function computeSignedContentHash(
  doc: Record<string, unknown>,
  excludeFields: string[] = [],
): string {
  const exclusions = new Set(["contentHash", "proof", ...excludeFields]);
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (!exclusions.has(key)) {
      rest[key] = value;
    }
  }
  return createHash("sha256").update(canonicalJson(rest), "utf8").digest("hex");
}

/**
 * sha256 hex over the canonical JSON of `doc` with `contentHash`, `proof`, and
 * `generatedAt` removed. RFC-1113: `generatedAt` is a build timestamp — including
 * it would produce a spurious hash (and signature) change on every rebuild.
 */
export function computeAgentManifestContentHash(doc: Record<string, unknown>): string {
  return computeSignedContentHash(doc, ["generatedAt"]);
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/** Pure: assemble + hash the manifest. Deterministic — sorts refs and languages. */
export function buildAgentSurfaceManifest(input: AgentSurfaceManifestInput): AgentSurfaceManifest {
  // RFC-1113: honesty invariant — supportedProtocols lists only what the surface
  // emits. The unconditional entries are the artifacts every enabled agent
  // surface generates (llms.txt, api-catalog linkset, ai-catalog ARD document,
  // DNS-AID record, agent-skills index); the conditional ones follow interfaces.
  const supportedProtocols: AgentProtocol[] = (
    [
      "agent-skills",
      "ard",
      "dns-aid",
      "linkset",
      "llms",
      "schemamap",
      ...(input.mcp ? ["mcp"] : []),
      ...(input.a2a ? ["a2a"] : []),
      ...(input.openapiUrl ? ["openapi"] : []),
      ...(input.search ? ["search"] : []),
      ...(input.nlweb ? ["nlweb"] : []),
      ...(input.hasTwins ? ["twins"] : []),
    ] as AgentProtocol[]
  ).sort();
  const base: Omit<AgentSurfaceManifest, "contentHash"> = {
    $schema: AGENT_SURFACE_SCHEMA_ID,
    surfaceVersion: AGENT_SURFACE_VERSION,
    site: input.site,
    baseUrl: input.baseUrl.replace(/\/+$/, ""),
    generatedAt: input.generatedAt,
    supportedProtocols,
    languages: {
      default: input.languages.default,
      supported: [...input.languages.supported].sort(),
    },
    knowledge: [...(input.knowledge ?? [])].sort((a, b) => a.domain.localeCompare(b.domain)),
    actions: [...(input.actions ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    claims: [...(input.claims ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    interfaces: {
      llms: "/llms.txt",
      schemamap: "/schemamap.xml",
      twins: input.hasTwins ? { pattern: "/**.md" } : null,
      openapi: input.openapiUrl ?? null,
      mcp: input.mcp ?? null,
      a2a: input.a2a ?? null,
      search: input.search ?? null,
      nlweb: input.nlweb ?? null,
    },
    proof: null,
  };
  const contentHash = computeAgentManifestContentHash(base as unknown as Record<string, unknown>);
  return { ...base, contentHash };
}
