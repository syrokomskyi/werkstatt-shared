/*
<MODULE_CONTRACT>
<purpose>RFC-0783: determinism + shape tests for the API Catalog linkset projection.</purpose>
<keywords>RFC-0783, agent surface, API Catalog, linkset, test</keywords>
</MODULE_CONTRACT>
<MODULE_MAP>
  <entry key="tests">empty manifest, knowledge ref projection, mcp link entries, determinism.</entry>
</MODULE_MAP>
<CHANGE_SUMMARY>
  <item>RFC-0783: initial API Catalog projection tests.</item>
  <item>RFC-1113: align agent discovery surface with RFC 9727 and MCP 2026-07-28 stateless era</item>
</CHANGE_SUMMARY>
*/

import { test, expect } from "vitest";
import { buildApiCatalog } from "../api-catalog.ts";
import { buildAgentSurfaceManifest } from "../manifest.ts";

test("buildApiCatalog: empty manifest yields service-meta + service-doc links", () => {
  const manifest = buildAgentSurfaceManifest({
    generatedAt: "2026-01-01T00:00:00.000Z",
    site: "s",
    baseUrl: "https://s.example",
    languages: { default: "de", supported: ["de"] },
  });
  const catalog = buildApiCatalog(manifest);
  const entry = catalog.linkset[0];
  expect(entry.anchor).toBe("https://s.example/");
  const serviceMeta = entry["service-meta"] as { href: string }[];
  expect(serviceMeta).toHaveLength(1);
  expect(serviceMeta[0].href).toBe("/.well-known/agent.json");
  const serviceDoc = entry["service-doc"] as { href: string }[];
  expect(serviceDoc).toHaveLength(1);
  expect(serviceDoc[0].href).toBe("/llms.txt");
});

test("buildApiCatalog: one knowledge ref → one item link", () => {
  const manifest = buildAgentSurfaceManifest({
    generatedAt: "2026-01-01T00:00:00.000Z",
    site: "s",
    baseUrl: "https://s.example",
    languages: { default: "de", supported: ["de"] },
    knowledge: [
      { domain: "offer", url: "/api/agent/v1/offer.json", schema: "gogol.agent.knowledge/offer@1" },
    ],
  });
  const catalog = buildApiCatalog(manifest);
  const itemLinks = catalog.linkset[0]["item"] as { href: string; type: string; title: string }[];
  expect(itemLinks).toHaveLength(1);
  expect(itemLinks[0].href).toBe("/api/agent/v1/offer.json");
  expect(itemLinks[0].type).toBe("application/json");
  expect(itemLinks[0].title).toBe("offer");
});

test("buildApiCatalog: mcp interface adds service-desc + service links", () => {
  const manifest = buildAgentSurfaceManifest({
    generatedAt: "2026-01-01T00:00:00.000Z",
    site: "s",
    baseUrl: "https://s.example",
    languages: { default: "de", supported: ["de"] },
    mcp: { url: "/api/agent/mcp", protocolVersion: "2025-06-18" },
  });
  const catalog = buildApiCatalog(manifest);
  const entry = catalog.linkset[0];
  const descHrefs = (entry["service-desc"] as { href: string }[]).map((l) => l.href);
  expect(descHrefs).toContain("/.well-known/mcp/server-card.json");
  const service = entry["service"] as { href: string }[];
  expect(service[0].href).toBe("/api/agent/mcp");
});

test("buildApiCatalog: determinism — same input produces identical output", () => {
  const input = {
    site: "s",
    baseUrl: "https://s.example",
    languages: { default: "de", supported: ["de"] },
    generatedAt: "2026-01-01T00:00:00.000Z",
    knowledge: [
      { domain: "offer", url: "/api/agent/v1/offer.json", schema: "gogol.agent.knowledge/offer@1" },
      { domain: "team", url: "/api/agent/v1/team.json", schema: "gogol.agent.knowledge/team@1" },
    ],
    mcp: { url: "/api/agent/mcp", protocolVersion: "2025-06-18" },
  };
  const a = buildApiCatalog(buildAgentSurfaceManifest(input));
  const b = buildApiCatalog(buildAgentSurfaceManifest(input));
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});

test("buildApiCatalog: links are sorted by href within each relation", () => {
  const manifest = buildAgentSurfaceManifest({
    generatedAt: "2026-01-01T00:00:00.000Z",
    site: "s",
    baseUrl: "https://s.example",
    languages: { default: "de", supported: ["de"] },
    knowledge: [
      { domain: "zeta", url: "/api/agent/v1/zeta.json", schema: "gogol.agent.knowledge/zeta@1" },
      { domain: "alpha", url: "/api/agent/v1/alpha.json", schema: "gogol.agent.knowledge/alpha@1" },
    ],
  });
  const catalog = buildApiCatalog(manifest);
  const itemHrefs = (catalog.linkset[0]["item"] as { href: string }[]).map((l) => l.href);
  const sorted = [...itemHrefs].sort();
  expect(itemHrefs).toEqual(sorted);
});

// ---------------------------------------------------------------------------
// RFC-1171: successor-version links (AC-7)
// ---------------------------------------------------------------------------

test("buildApiCatalog: deprecations[] project successor-version link entries (AC-7)", () => {
  const manifest = buildAgentSurfaceManifest({
    generatedAt: "2026-01-01T00:00:00.000Z",
    site: "s",
    baseUrl: "https://s.example",
    languages: { default: "de", supported: ["de"] },
    actions: [
      {
        id: "lead.submit",
        url: "/api/agent/v1/actions/lead.submit",
        title: { de: "Anfrage senden" },
        inputSchemaRef: "#/x",
        entitlement: "agent.actions",
      },
    ],
  });
  const catalog = buildApiCatalog(manifest);
  const depEntries = catalog.linkset.filter(
    (e) => Array.isArray(e["successor-version"]),
  );
  expect(depEntries).toHaveLength(1);
  expect(depEntries[0].anchor).toBe("https://s.example/api/agent/actions/lead.submit");
  const links = depEntries[0]["successor-version"] as { href: string }[];
  expect(links[0].href).toBe("/api/agent/v1/actions/lead.submit");
});
