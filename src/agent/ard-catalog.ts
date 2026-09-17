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
</CHANGE_SUMMARY>
*/

import type { AgentSurfaceManifest } from "./manifest.ts";

/** ARD ai-catalog entry — one per discoverable resource. */
export interface ArdCatalogEntry {
  identifier: string;
  displayName: string;
  type: string;
  url: string;
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

  const entries: ArdCatalogEntry[] = [];

  // MCP server card entry
  if (manifest.interfaces.mcp) {
    entries.push({
      identifier: `urn:air:${domain}:server:mcp`,
      displayName: "MCP Server",
      type: "application/mcp-server-card+json",
      url: "/.well-known/mcp/server-card.json",
      representativeQueries: [
        "What tools are available on this MCP server",
        "List MCP server capabilities and endpoints",
      ],
    });
  }

  // A2A Agent Card entry
  entries.push({
    identifier: `urn:air:${domain}:agent:a2a`,
    displayName: "A2A Agent Card",
    type: "application/a2a+json",
    url: "/.well-known/agent-card.json",
    representativeQueries: [
      "What agent capabilities does this site offer",
      "Get the A2A agent card for this service",
    ],
  });

  // OpenAPI entry
  if (manifest.interfaces.openapi) {
    entries.push({
      identifier: `urn:air:${domain}:api:openapi`,
      displayName: "OpenAPI Specification",
      type: "application/vnd.oai.openapi+json",
      url: manifest.interfaces.openapi,
      representativeQueries: [
        "What API endpoints are available on this site",
        "Get the OpenAPI specification for agent integration",
      ],
    });
  }

  // Agent Surface Manifest entry
  entries.push({
    identifier: `urn:air:${domain}:manifest:agent-surface`,
    displayName: "Agent Surface Manifest",
    type: "application/json",
    url: "/.well-known/agent.json",
    representativeQueries: [
      "What agent discovery endpoints does this site provide",
      "Get the agent surface manifest for this site",
    ],
  });

  // Semantic search endpoint entry
  if (manifest.interfaces.search) {
    entries.push({
      identifier: `urn:air:${domain}:api:search`,
      displayName: "Semantic Search",
      type: "application/json",
      url: manifest.interfaces.search.url,
      representativeQueries: [
        "Search this site for relevant content",
        "Find pages matching a natural language query",
      ],
    });
  }

  // Knowledge domain entries
  for (const ref of manifest.knowledge) {
    entries.push({
      identifier: `urn:air:${domain}:knowledge:${ref.domain}`,
      displayName: `${ref.domain.charAt(0).toUpperCase() + ref.domain.slice(1)} Knowledge`,
      type: "application/json",
      url: ref.url,
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
