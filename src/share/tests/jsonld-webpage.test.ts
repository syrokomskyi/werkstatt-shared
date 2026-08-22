/*
<MODULE_CONTRACT>
  <purpose>Test that buildWebPageNode emits correct speakable cssSelector matching the rendered section-header__subheading class.</purpose>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial test for speakable cssSelector referencing section-header__subheading (not section-header__lead).</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";
import { buildWebPageNode } from "../semantic/jsonld/webpage.ts";
import { createJsonLdContext } from "../semantic/jsonld/context.ts";
import type { SemanticPageModel, SemanticOrganization } from "../semantic/models.ts";

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
