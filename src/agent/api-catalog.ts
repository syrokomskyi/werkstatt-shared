/*
<MODULE_CONTRACT>
<purpose>
RFC-0783: pure, dependency-free formatter that projects a site's Agent Surface
Manifest into an RFC 9727 linkset+json document for /.well-known/api-catalog.
No I/O — the kernel command loads the manifest and passes it here.
</purpose>
<non-goals>
  <item>Do not read files — callers load and pass the manifest.</item>
  <item>Do not sign — signing is a separate concern (agent.surface.sign).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0783: initial API Catalog linkset+json projection.</item>
  <item>RFC-0954: add search endpoint link when interfaces.search is non-null.</item>
  <item>RFC-1114: link agent-card.json (service-desc) + a2a endpoint (service) when interfaces.a2a is non-null.</item>
  <item>RFC-1114: minimal real A2A endpoint + honest agent card</item>
  <item>RFC-1171: successor-version link entries per manifest deprecations[] — deprecated aliases anchored, pointing at canonical successors.</item>
</CHANGE_SUMMARY>
*/

import type { AgentSurfaceManifest } from "./manifest.ts";

/** RFC 9264 linkset+json link object — no `rel` (it's the key in the linkset entry). */
export interface ApiCatalogLink {
  href: string;
  type: string;
  title?: string;
}

/** RFC 9264 linkset entry — anchor + relation-keyed link arrays. */
export interface ApiCatalogEntry {
  anchor: string;
  [relation: string]: string | ApiCatalogLink[];
}

/** RFC 9264 linkset document — top-level `linkset` array. */
export interface ApiCatalog {
  linkset: ApiCatalogEntry[];
}

/**
 * Pure: project Agent Surface Manifest into RFC 9264 linkset+json.
 * Deterministic — links within each relation are sorted by href for byte-identical output (DNA-58).
 */
export function buildApiCatalog(manifest: AgentSurfaceManifest): ApiCatalog {
  const anchor = manifest.baseUrl.replace(/\/+$/, "") + "/";
  const entry: ApiCatalogEntry = { anchor };

  const item: ApiCatalogLink[] = manifest.knowledge.map((ref) => ({
    href: ref.url,
    type: "application/json",
    title: ref.domain,
  }));
  if (item.length > 0) {
    item.sort((a, b) => a.href.localeCompare(b.href));
    entry["item"] = item;
  }

  entry["service-meta"] = [{ href: "/.well-known/agent.json", type: "application/json" }];

  const serviceDesc: ApiCatalogLink[] = [];
  if (manifest.interfaces.openapi) {
    serviceDesc.push({ href: manifest.interfaces.openapi, type: "application/json" });
  }
  if (manifest.interfaces.mcp) {
    serviceDesc.push({ href: "/.well-known/mcp/server-card.json", type: "application/json" });
  }
  if (manifest.interfaces.a2a) {
    serviceDesc.push({ href: "/.well-known/agent-card.json", type: "application/json" });
  }
  if (serviceDesc.length > 0) {
    serviceDesc.sort((a, b) => a.href.localeCompare(b.href));
    entry["service-desc"] = serviceDesc;
  }

  const service: ApiCatalogLink[] = [];
  if (manifest.interfaces.mcp) {
    service.push({ href: manifest.interfaces.mcp.url, type: "application/json" });
  }
  if (manifest.interfaces.a2a) {
    service.push({ href: manifest.interfaces.a2a.url, type: "application/json" });
  }
  if (service.length > 0) {
    service.sort((a, b) => a.href.localeCompare(b.href));
    entry["service"] = service;
  }

  if (manifest.interfaces.search) {
    entry["search"] = [{ href: manifest.interfaces.search.url, type: "application/json" }];
  }

  entry["service-doc"] = [{ href: manifest.interfaces.llms, type: "text/plain" }];

  // RFC-1171: deprecated alias paths appear as successor-version links —
  // one entry per covered action, anchored at the deprecated concrete path.
  const deprecationEntries: ApiCatalogEntry[] = [];
  for (const dep of manifest.deprecations ?? []) {
    for (const ref of manifest.actions) {
      const successorUrl = dep.successor.replaceAll("{id}", ref.id);
      if (successorUrl !== ref.url) continue;
      deprecationEntries.push({
        anchor: anchor.replace(/\/+$/, "") + dep.path.replaceAll("{id}", ref.id),
        "successor-version": [{ href: successorUrl, type: "application/json", title: dep.reason }],
      });
    }
  }

  return { linkset: [entry, ...deprecationEntries] };
}
