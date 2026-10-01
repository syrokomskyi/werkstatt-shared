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
  <item>RFC-1115: search results flattened to citation shape (title, canonicalUrl, updatedAt, lang, type, score, text) under the existing 2.0.0 surface; capability agentGuidance rendered into tool/operation descriptions.</item>
  <item>RFC-1165: add "nlweb" to AgentProtocol and conditional interfaces.nlweb (populated iff the SSR/search interface chain serves — static sites never advertise it).</item>
  <item>RFC-1171: ManifestDeprecation + platform-injected unversioned→v1 deprecations[] with fixed date constants (determinism), validateManifestDeprecations enforcing successor resolution and the 90-day sunset window.</item>
  <item>RFC-1113: supportedProtocols comment update — unconditional ARD emission now spans ard.json + ai-catalog.json, agent-skills spans index + per-domain SKILL.md.</item>
  <history>RFC-0286, RFC-0954, RFC-1076, RFC-1112, RFC-1113, RFC-1114</history>
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

/**
 * RFC-1171: closed deprecation declaration — every deprecated machine path
 * carries a successor, a human/model-readable reason, and a calendar window.
 * The schema is closed; extending it requires an RFC (DNA-19 principle).
 */
export interface ManifestDeprecation {
  /** Deprecated path pattern, e.g. "/api/agent/actions/{id}". */
  path: string;
  /** Successor path pattern, e.g. "/api/agent/v1/actions/{id}". */
  successor: string;
  /** Human + model readable migration note. */
  reason: string;
  /** ISO date (YYYY-MM-DD) — Deprecation header appears from this date on. */
  deprecateAt: string;
  /** ISO date (YYYY-MM-DD) — the alias is removed no earlier than this. */
  sunsetAt: string;
}

/** RFC-1171: canonical versioned action path pattern. */
export const AGENT_ACTION_V1_PATH = "/api/agent/v1/actions/{id}";
/** RFC-1171: the deprecated unversioned alias path pattern. */
export const AGENT_ACTION_ALIAS_PATH = "/api/agent/actions/{id}";

/**
 * RFC-1171: the platform-injected deprecation entry for the unversioned action
 * namespace. Dates are FIXED constants — never derive them from build time;
 * generatedAt is excluded from contentHash, but a changing deprecateAt would
 * poison the deterministic hash (AS-7, DNA-58). 90-day minimum window honored.
 */
export const AGENT_ACTION_DEPRECATION: ManifestDeprecation = {
  path: AGENT_ACTION_ALIAS_PATH,
  successor: AGENT_ACTION_V1_PATH,
  reason: "Actions moved into the versioned namespace (RFC-1171).",
  deprecateAt: "2026-10-01",
  sunsetAt: "2027-04-01",
};

/** RFC-1171: minimum sunset window in milliseconds (90 days). */
export const DEPRECATION_MIN_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * RFC-1171: validate `deprecations[]` entries against the emitted action set.
 * Returns a list of violations (empty = valid). Pure — callers decide whether
 * to throw (builder, fail-closed at generation) or report (surface validator).
 *
 * Rules: ISO dates; successor must resolve — every emitted action url must
 * equal the successor pattern with `{id}` substituted; the deprecated path
 * must not itself be a live canonical url; sunsetAt - deprecateAt >= 90 days.
 */
export function validateManifestDeprecations(
  deprecations: ManifestDeprecation[],
  actions: AgentActionRef[],
): string[] {
  const errors: string[] = [];
  for (const dep of deprecations) {
    if (!ISO_DATE_RE.test(dep.deprecateAt) || Number.isNaN(Date.parse(dep.deprecateAt))) {
      errors.push(
        `deprecation '${dep.path}': deprecateAt '${dep.deprecateAt}' is not a valid YYYY-MM-DD date`,
      );
    }
    if (!ISO_DATE_RE.test(dep.sunsetAt) || Number.isNaN(Date.parse(dep.sunsetAt))) {
      errors.push(
        `deprecation '${dep.path}': sunsetAt '${dep.sunsetAt}' is not a valid YYYY-MM-DD date`,
      );
    }
    if (!dep.path.startsWith("/api/agent/") || !dep.successor.startsWith("/api/agent/")) {
      errors.push(`deprecation '${dep.path}': path and successor must live under /api/agent/`);
    }
    if (dep.path === dep.successor) {
      errors.push(`deprecation '${dep.path}': successor equals the deprecated path`);
    }
    if (
      !Number.isNaN(Date.parse(dep.deprecateAt)) &&
      !Number.isNaN(Date.parse(dep.sunsetAt)) &&
      Date.parse(dep.sunsetAt) - Date.parse(dep.deprecateAt) < DEPRECATION_MIN_WINDOW_MS
    ) {
      errors.push(
        `deprecation '${dep.path}': sunsetAt is less than 90 days after deprecateAt (window: ${dep.deprecateAt} → ${dep.sunsetAt})`,
      );
    }
    if (actions.length === 0) {
      errors.push(
        `deprecation '${dep.path}': no emitted actions to resolve successor '${dep.successor}'`,
      );
      continue;
    }
    for (const action of actions) {
      const resolved = dep.successor.replaceAll("{id}", action.id);
      if (resolved !== action.url) {
        errors.push(
          `deprecation '${dep.path}': successor '${dep.successor}' does not resolve emitted action '${action.id}' ('${resolved}' != '${action.url}')`,
        );
      }
      const deprecatedResolved = dep.path.replaceAll("{id}", action.id);
      if (deprecatedResolved === action.url) {
        errors.push(
          `deprecation '${dep.path}': deprecated path resolves to the canonical url of '${action.id}' — a live path cannot be deprecated`,
        );
      }
    }
  }
  return errors;
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
  /**
   * RFC-1171: declarative deprecation — closed declaration projected into
   * agent.json, OpenAPI, api-catalog, and gate-stamped response headers.
   * Platform-injected; sites never author it.
   */
  deprecations: ManifestDeprecation[];
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
  /**
   * RFC-1171: extra deprecation declarations (platform code only — never
   * site-authored). The unversioned→v1 action entry is injected automatically
   * when actions exist; do not repeat it here.
   */
  deprecations?: ManifestDeprecation[];
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
  // surface generates (llms.txt, api-catalog linkset, ARD catalog documents
  // at .well-known/ard.json + ai-catalog.json, DNS-AID record, agent-skills
  // index + per-domain SKILL.md); the conditional ones follow interfaces.
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
    deprecations: mergeDeprecations(input),
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
  // RFC-1171: fail-closed at generation — an unresolving successor or a
  // sub-90-day window must never reach a deployed agent.json (AC-3, AC-4).
  const deprecationErrors = validateManifestDeprecations(base.deprecations, base.actions);
  if (deprecationErrors.length > 0) {
    throw new Error(
      `agent surface manifest: invalid deprecations[] — ${deprecationErrors.join("; ")}`,
    );
  }
  const contentHash = computeAgentManifestContentHash(base as unknown as Record<string, unknown>);
  return { ...base, contentHash };
}

/**
 * RFC-1171: platform injection — the unversioned→v1 action deprecation is
 * declared automatically when the surface emits actions; caller-provided
 * entries (platform code only) merge on top, deduplicated by path.
 */
function mergeDeprecations(input: AgentSurfaceManifestInput): ManifestDeprecation[] {
  const list = [...(input.deprecations ?? [])];
  if ((input.actions?.length ?? 0) > 0 && !list.some((d) => d.path === AGENT_ACTION_ALIAS_PATH)) {
    list.push(AGENT_ACTION_DEPRECATION);
  }
  return list.sort((a, b) => a.path.localeCompare(b.path));
}
