/*
<MODULE_CONTRACT>
  <purpose>
Unit tests for jsonld webpage covering buildWebPageNode speakable cssSelector. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: carried legacy entry — Initial test for speakable cssSelector referencing section-header__subheading (not section-header__lead).</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";
import { buildWebPageNode } from "../jsonld/webpage.ts";
import { createJsonLdContext } from "../jsonld/context.ts";
import type { SemanticPageModel, SemanticOrganization } from "../models.ts";

function makeModel(overrides: Partial<SemanticPageModel> = {}): SemanticPageModel {
  const org: SemanticOrganization = {
    name: "Test Org",
    description: "Test organization",
    url: "https://example.com",
  };
  return {
    type: "home",
    lang: "de",
    url: "https://example.com/de",
    title: "Test Page",
    description: "Test description",
    breadcrumbs: [],
    blocks: [],
    organization: org,
    ...overrides,
  };
}

describe("buildWebPageNode speakable cssSelector", () => {
  it("references section-header__subheading (not section-header__lead) when page has lead", () => {
    const model = makeModel({
      lead: "Test lead text",
      blocks: [{ id: "block-1", heading: "Section heading" }],
    });
    const context = createJsonLdContext(model);
    const node = buildWebPageNode(context);
    const speakable = node.speakable as { cssSelector: string[] };
    expect(speakable).toBeDefined();
    expect(speakable.cssSelector).toContain("h1");
    expect(speakable.cssSelector).toContain(".section-header__subheading");
    expect(speakable.cssSelector).not.toContain(".section-header__lead");
  });

  it("emits only h1 selector when page has no lead", () => {
    const model = makeModel({
      blocks: [{ id: "block-1", heading: "Section heading" }],
    });
    const context = createJsonLdContext(model);
    const node = buildWebPageNode(context);
    const speakable = node.speakable as { cssSelector: string[] };
    expect(speakable).toBeDefined();
    expect(speakable.cssSelector).toEqual(["h1"]);
  });

  it("omits speakable when no blocks have headings", () => {
    const model = makeModel({
      lead: "Test lead text",
      blocks: [{ id: "block-1", heading: "" }],
    });
    const context = createJsonLdContext(model);
    const node = buildWebPageNode(context);
    expect(node.speakable).toBeUndefined();
  });
});
