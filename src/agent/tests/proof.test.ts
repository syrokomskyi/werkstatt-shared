/*
<MODULE_CONTRACT>
<purpose>
Unit tests for proof covering its documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0308: initial proof payload tests.</item>
</CHANGE_SUMMARY>
*/

import { test, expect } from "vitest";
import {
  buildAgentSigningPayload,
  AGENT_PROOF_DOMAIN,
  type AgentProofArtifactKind,
} from "../proof.ts";

function decodePayload(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

test("buildAgentSigningPayload: produces domain-separated canonical text", () => {
  const payload = buildAgentSigningPayload(
    "manifest",
    "https://warpgogol.com/.well-known/agent.json",
    "abc123",
  );
  const text = decodePayload(payload);
  expect(text).toBe(
    `${AGENT_PROOF_DOMAIN}\nmanifest\nhttps://warpgogol.com/.well-known/agent.json\nabc123`,
  );
});

test("buildAgentSigningPayload: different artifact kinds produce different payloads", () => {
  const url = "https://warpgogol.com/.well-known/agent.json";
  const hash = "abc123";
  const kinds: AgentProofArtifactKind[] = ["manifest", "knowledge", "openapi"];
  const payloads = new Set<string>();
  for (const kind of kinds) {
    payloads.add(decodePayload(buildAgentSigningPayload(kind, url, hash)));
  }
  expect(payloads.size).toBe(kinds.length);
});

test("buildAgentSigningPayload: different URLs produce different payloads", () => {
  const a = decodePayload(buildAgentSigningPayload("manifest", "https://a.com/agent.json", "h"));
  const b = decodePayload(buildAgentSigningPayload("manifest", "https://b.com/agent.json", "h"));
  expect(a).not.toBe(b);
});

test("buildAgentSigningPayload: different content hashes produce different payloads", () => {
  const a = decodePayload(buildAgentSigningPayload("manifest", "https://a.com/agent.json", "h1"));
  const b = decodePayload(buildAgentSigningPayload("manifest", "https://a.com/agent.json", "h2"));
  expect(a).not.toBe(b);
});

test("buildAgentSigningPayload: is deterministic for identical inputs", () => {
  const a = buildAgentSigningPayload(
    "knowledge",
    "https://warpgogol.com/api/agent/v1/offer.json",
    "hash",
  );
  const b = buildAgentSigningPayload(
    "knowledge",
    "https://warpgogol.com/api/agent/v1/offer.json",
    "hash",
  );
  expect(a).toEqual(b);
});
