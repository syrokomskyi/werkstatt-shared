/*
<MODULE_CONTRACT>
<purpose>
  RFC-0786: Pure projection from AgentSurfaceManifest to DNS-AID SVCB record
  declaration. DNS-AID is a DNS-based agent discovery mechanism: an SVCB record
  at _index._agents.<domain> with target pointing to the host serving
  agent.json, and standard SvcParams (alpn, port) per RFC 9460.
</purpose>
<non-goals>
  <item>Do not perform I/O — this is a pure function (DNA-58).</item>
  <item>Do not write to dns-records.yaml — that is the command handler's job.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0786: initial DNS-AID record builder — TXT record at _agent.<domain>.</item>
  <item>RFC-0786: updated to SVCB record at _index._agents.<domain> per DNS-AID spec.</item>
  <item>RFC-1162: DNS-AID _mcp record + live-zone drift validation (AGD-05/06)</item>
</CHANGE_SUMMARY>
*/

import type { AgentSurfaceManifest } from "./manifest.ts";

export interface DnsAidRecord {
  name: string;
  type: "SVCB";
  content: string;
  ttl: number;
  proxied: false;
}

/**
 * Build the DNS-AID SVCB record declarations from the agent surface manifest.
 * Pure function — no I/O, no side effects (DNA-58).
 *
 * Always emits `_index._agents.<domain>` — the agent-surface index record
 * (per DNS-AID spec) whose target is the host serving agent.json.
 *
 * RFC-1162: when `manifest.interfaces.mcp` is declared (RFC-1114), also emits
 * `_mcp._agents.<domain>` — the per-service record advertising the MCP
 * endpoint. Its targetName derives from `interfaces.mcp.url`'s hostname, not
 * baseUrl's: the record advertises where MCP is actually served, which can
 * differ for hosted endpoints.
 *
 * Each record is an SVCB service record (RFC 9460) with:
 *   priority: 1 (service mode)
 *   target: <hostname>
 *   alpn: h2 (HTTP/2)
 *   port: 443 (HTTPS)
 * TTL is 3600 seconds (1 hour).
 */
export function buildDnsAidRecords(manifest: AgentSurfaceManifest): DnsAidRecord[] {
  const domain = new URL(manifest.baseUrl).hostname;
  const records: DnsAidRecord[] = [
    {
      name: `_index._agents.${domain}`,
      type: "SVCB",
      content: `1 ${domain} alpn=h2 port=443`,
      ttl: 3600,
      proxied: false,
    },
  ];

  const mcp = manifest.interfaces?.mcp;
  if (mcp?.url) {
    const mcpHost = new URL(mcp.url).hostname;
    records.push({
      name: `_mcp._agents.${domain}`,
      type: "SVCB",
      content: `1 ${mcpHost} alpn=h2 port=443`,
      ttl: 3600,
      proxied: false,
    });
  }

  return records;
}
