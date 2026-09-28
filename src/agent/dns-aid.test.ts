/*
<MODULE_CONTRACT>
<purpose>
RFC-0786: Unit tests for the buildDnsAidRecord pure function.
Verifies determinism, domain extraction, and content URL construction.
</purpose>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0786: initial unit tests for buildDnsAidRecord.</item>
  <item>RFC-1162: DNS-AID _mcp record + live-zone drift validation (AGD-05/06)</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { buildDnsAidRecords } from "@warpgogol/werkstatt-shared/agent";
import type { AgentSurfaceManifest } from "@warpgogol/werkstatt-shared/agent";

function makeManifest(baseUrl: string): AgentSurfaceManifest {
  return {
    $schema: "agent-surface-manifest/1",
    surfaceVersion: "1.0.0",
    site: "test-site",
    baseUrl,
    generatedAt: "2026-09-28T00:00:00.000Z",
    languages: { default: "de", supported: ["de"] },
    supportedProtocols: [],
    contentHash: "abc123",
    knowledge: [],
    actions: [],
    claims: [],
    interfaces: { llms: "", twins: null, openapi: null, mcp: null, a2a: null, search: null },
    proof: null,
  };
}

describe("buildDnsAidRecords (RFC-0786, RFC-1162)", () => {
  it("builds record with _index._agents.<domain> name", () => {
    const [record] = buildDnsAidRecords(makeManifest("https://warpgogol.com"));
    expect(record.name).toBe("_index._agents.warpgogol.com");
  });

  it("builds record with SVCB type", () => {
    const [record] = buildDnsAidRecords(makeManifest("https://warpgogol.com"));
    expect(record.type).toBe("SVCB");
  });

  it("builds SVCB content with target, alpn and port params (RFC 9460)", () => {
    const [record] = buildDnsAidRecords(makeManifest("https://warpgogol.com"));
    expect(record.content).toBe("1 warpgogol.com alpn=h2 port=443");
  });

  it("sets ttl to 3600", () => {
    const [record] = buildDnsAidRecords(makeManifest("https://warpgogol.com"));
    expect(record.ttl).toBe(3600);
  });

  it("sets proxied to false", () => {
    const [record] = buildDnsAidRecords(makeManifest("https://warpgogol.com"));
    expect(record.proxied).toBe(false);
  });

  it("is deterministic — same input produces same output (DNA-58)", () => {
    const manifest = makeManifest("https://example.org");
    const r1 = buildDnsAidRecords(manifest);
    const r2 = buildDnsAidRecords(manifest);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("extracts domain from URL with port", () => {
    const [record] = buildDnsAidRecords(makeManifest("http://localhost:3000"));
    expect(record.name).toBe("_index._agents.localhost");
    expect(record.content).toBe("1 localhost alpn=h2 port=443");
  });

  it("strips trailing slash from baseUrl", () => {
    const [record] = buildDnsAidRecords(makeManifest("https://warpgogol.com/"));
    expect(record.content).toBe("1 warpgogol.com alpn=h2 port=443");
  });

  // RFC-1162 AC-1: interfaces.mcp declared → exactly two records.
  it("emits _mcp._agents.<domain> when interfaces.mcp is set (AC-1)", () => {
    const manifest = makeManifest("https://warpgogol.com");
    manifest.interfaces.mcp = { url: "https://warpgogol.com/mcp", protocolVersion: "2025-06-18" };
    const records = buildDnsAidRecords(manifest);
    expect(records).toHaveLength(2);
    expect(records[0].name).toBe("_index._agents.warpgogol.com");
    expect(records[1].name).toBe("_mcp._agents.warpgogol.com");
    expect(records[1].type).toBe("SVCB");
    expect(records[1].content).toBe("1 warpgogol.com alpn=h2 port=443");
  });

  // RFC-1162 AC-1: _mcp target derives from interfaces.mcp.url hostname,
  // not baseUrl — hosted MCP endpoints may live on a different host.
  it("derives _mcp target from interfaces.mcp.url hostname (AC-1)", () => {
    const manifest = makeManifest("https://warpgogol.com");
    manifest.interfaces.mcp = {
      url: "https://mcp.example.net/agent",
      protocolVersion: "2025-06-18",
    };
    const records = buildDnsAidRecords(manifest);
    expect(records[1].name).toBe("_mcp._agents.warpgogol.com");
    expect(records[1].content).toBe("1 mcp.example.net alpn=h2 port=443");
  });

  // RFC-1162 AC-1: deterministic for the same input.
  it("is deterministic with interfaces.mcp set (AC-1)", () => {
    const manifest = makeManifest("https://warpgogol.com");
    manifest.interfaces.mcp = { url: "https://warpgogol.com/mcp", protocolVersion: "2025-06-18" };
    const r1 = buildDnsAidRecords(manifest);
    const r2 = buildDnsAidRecords(manifest);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  // RFC-1162 AC-2: no interfaces.mcp → exactly one record, byte-identical
  // to the pre-RFC singular output shape.
  it("returns exactly one record without interfaces.mcp (AC-2)", () => {
    const records = buildDnsAidRecords(makeManifest("https://warpgogol.com"));
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      name: "_index._agents.warpgogol.com",
      type: "SVCB",
      content: "1 warpgogol.com alpn=h2 port=443",
      ttl: 3600,
      proxied: false,
    });
  });
});
