/*
<MODULE_CONTRACT>
<purpose>
Unit tests for llms 0789 covering its documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0789: initial tests for conditional agent discovery links in buildLlmsIndex.</item>
  <item>RFC-1311: carried legacy entry — Assert the fifth link — .well-known/ard.json (ARD v0.91 catalog) — present when enabled, absent when disabled.</item>
</CHANGE_SUMMARY>
*/

import { test, expect } from "vitest";
import { buildLlmsIndex } from "../llms.ts";
import type { SemanticSiteModel } from "../models.ts";

function makeSite(overrides: Partial<SemanticSiteModel> = {}): SemanticSiteModel {
  return {
    baseUrl: "https://example.com",
    lang: "de",
    organization: {
      name: "Test Org",
      description: "A test organization.",
      url: "https://example.com",
    },
    pages: [],
    ...overrides,
  };
}

test("buildLlmsIndex: agent absent → all 5 agent discovery links present", () => {
  const output = buildLlmsIndex(makeSite());
  expect(output).toContain("agent.json");
  expect(output).toContain("api-catalog");
  expect(output).toContain(".well-known/ard.json");
  expect(output).toContain("mcp/server-card.json");
  expect(output).toContain("agent.openapi.json");
});

test("buildLlmsIndex: agent.enabled true → all 5 agent discovery links present", () => {
  const output = buildLlmsIndex(makeSite({ agent: { enabled: true } }));
  expect(output).toContain("agent.json");
  expect(output).toContain("api-catalog");
  expect(output).toContain(".well-known/ard.json");
  expect(output).toContain("mcp/server-card.json");
  expect(output).toContain("agent.openapi.json");
});

test("buildLlmsIndex: agent.enabled false → zero agent discovery links", () => {
  const output = buildLlmsIndex(makeSite({ agent: { enabled: false } }));
  expect(output).not.toContain("agent.json");
  expect(output).not.toContain("api-catalog");
  expect(output).not.toContain(".well-known/ard.json");
  expect(output).not.toContain("server-card.json");
  expect(output).not.toContain("agent.openapi.json");
  expect(output).toContain("llms-full.txt");
});

test("buildLlmsIndex: agent links use absolute https URLs", () => {
  const output = buildLlmsIndex(makeSite());
  expect(output).toContain("https://example.com/.well-known/agent.json");
  expect(output).toContain("https://example.com/.well-known/api-catalog");
  expect(output).toContain("https://example.com/.well-known/ard.json");
  expect(output).toContain("https://example.com/.well-known/mcp/server-card.json");
  expect(output).toContain("https://example.com/.well-known/agent.openapi.json");
});
