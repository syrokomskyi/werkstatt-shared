/*
<MODULE_CONTRACT>
<purpose>
ARD (Agentic Resource Discovery) ai-catalog.json projection. Pure, dependency-free
formatter that projects a site's Agent Surface Manifest into the ai-catalog data model
for /.well-known/ai-catalog.json. No I/O — the kernel command loads the manifest and
passes it here.
</purpose>
<non-goals>
  <item>Do not read files — callers load and pass the manifest.</item>
  <item>Do not duplicate logic from api-catalog or mcp-card — this is a separate spec.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
  <item>Schema-conformant catalog: absolute-URI url fields (ai-catalog schema format "uri"), ARD-whitelisted types only (a2a-agent-card+json, mcp-server-card+json, agent-skills markdown profile for knowledge SKILL.md docs), per-entry @context + description; non-whitelisted support docs (openapi, search, agent.json) stay advertised via api-catalog/agent.json/Link headers instead of catalog entries.</item>
</CHANGE_SUMMARY>
*/

import type { AgentSurfaceManifest } from "./manifest.ts";
import { toAbsoluteUrl } from "../semantic/ids.ts";
import { AGENT_SKILL_MD_TYPE, knowledgeSkillMdPath } from "./skill-md.ts";

/**
 * ARD base context (v0.91) — attached per entry so each JSON-LD node expands
 * standalone in generic tooling (spec §4.1 SHOULD).
 */
export const ARD_BASE_CONTEXT = "https://agenticresourcediscovery.org/context/v1";

/**
 * Media types recognized by the ARD conformance tooling / ai-catalog audits.
 * Only agentic resources with a whitelisted type are catalog entries —
 * supporting documents (OpenAPI, knowledge JSON, search, agent.json) stay
 * advertised via the api-catalog linkset, agent.json, and Link headers.
 */
export const ARD_A2A_AGENT_CARD_TYPE = "application/a2a-agent-card+json";
export const ARD_MCP_SERVER_CARD_TYPE = "application/mcp-server-card+json";

/** ARD ai-catalog entry — one per discoverable resource. */
export interface ArdCatalogEntry {
  "@context": string;
  identifier: string;
  displayName: string;
  type: string;
  url: string;
  description: string;
  representativeQueries: string[];
}

/** ARD ai-catalog host object. */
export interface ArdCatalogHost {
  displayName: string;
  identifier: string;
}

/** ARD ai-catalog top-level document. */
export interface ArdCatalog {
  specVersion: string;
  host: ArdCatalogHost;
  entries: ArdCatalogEntry[];
}

/**
 * Pure: project Agent Surface Manifest into ARD ai-catalog.json.
 * Deterministic — entries are sorted by identifier for byte-identical output (DNA-58).
 */
export function buildArdCatalog(
  manifest: AgentSurfaceManifest,
  hostDisplayName?: string,
): ArdCatalog {
  const domain = manifest.baseUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const displayName = hostDisplayName ?? manifest.site;
  const abs = (url: string): string => toAbsoluteUrl(manifest.baseUrl, url);

  const entries: ArdCatalogEntry[] = [];

  // MCP server card entry
  if (manifest.interfaces.mcp) {
    entries.push({
      "@context": ARD_BASE_CONTEXT,
      identifier: `urn:air:${domain}:server:mcp`,
      displayName: "MCP Server",
      type: ARD_MCP_SERVER_CARD_TYPE,
      url: abs("/.well-known/mcp/server-card.json"),
      description:
        "MCP server card describing the site's Model Context Protocol tools and endpoint.",
      representativeQueries: [
        "What tools are available on this MCP server",
        "List MCP server capabilities and endpoints",
      ],
    });
  }

  // A2A Agent Card entry
  entries.push({
    "@context": ARD_BASE_CONTEXT,
    identifier: `urn:air:${domain}:agent:a2a`,
    displayName: "A2A Agent Card",
    type: ARD_A2A_AGENT_CARD_TYPE,
    url: abs("/.well-known/agent-card.json"),
    description: "A2A agent card describing the site's agent capabilities, skills, and endpoint.",
    representativeQueries: [
      "What agent capabilities does this site offer",
      "Get the A2A agent card for this service",
    ],
  });

  // Knowledge domain entries — each points at the domain's SKILL.md skill
  // document, which carries the canonical JSON endpoint in its frontmatter.
  for (const ref of manifest.knowledge) {
    entries.push({
      "@context": ARD_BASE_CONTEXT,
      identifier: `urn:air:${domain}:knowledge:${ref.domain}`,
      displayName: `${ref.domain.charAt(0).toUpperCase() + ref.domain.slice(1)} Knowledge`,
      type: AGENT_SKILL_MD_TYPE,
      url: abs(knowledgeSkillMdPath(ref.domain)),
      description: `Agent skill document for the site's canonical ${ref.domain} knowledge.`,
      representativeQueries: [
        `What ${ref.domain} information is available on this site`,
        `Get structured ${ref.domain} data for agent consumption`,
      ],
    });
  }

  // Sort entries by identifier for deterministic output
  entries.sort((a, b) => a.identifier.localeCompare(b.identifier));

  return {
    specVersion: "1.0",
    host: {
      displayName,
      identifier: `did:web:${domain}`,
    },
    entries,
  };
}
