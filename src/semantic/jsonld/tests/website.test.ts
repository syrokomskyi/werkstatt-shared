/*
<MODULE_CONTRACT>
<purpose>
Unit tests for website covering buildWebSiteNode. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the website suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";
import { buildWebSiteNode } from "../website.ts";
import { createJsonLdContext } from "../context.ts";
import { makePage } from "../../tests/helpers.ts";

describe("buildWebSiteNode", () => {
  it("builds WebSite node with organization URL and language", () => {
    const page = makePage({ lang: "de" });
    const ctx = createJsonLdContext(page);
    const node = buildWebSiteNode(ctx);
    expect(node["@type"]).toBe("WebSite");
    expect(node["@id"]).toBe(ctx.ids.website);
    expect(node.url).toBe(page.organization.url);
    expect(node.inLanguage).toBe("de");
    expect(node.publisher).toEqual({ "@id": ctx.ids.organization });
  });

  it("uses organization name for WebSite name", () => {
    const page = makePage({
      organization: makePage().organization,
    });
    page.organization.name = "Test Org";
    const ctx = createJsonLdContext(page);
    const node = buildWebSiteNode(ctx);
    expect(node.name).toBe("Test Org");
  });
});
