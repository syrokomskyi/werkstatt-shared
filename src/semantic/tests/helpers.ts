import type { SemanticOrganization, SemanticPageModel, SemanticPageType } from "../models.ts";

export function makeOrganization(
  overrides: Partial<SemanticOrganization> = {},
): SemanticOrganization {
  return {
    name: "Warpgogol",
    description: "Digital infrastructure for nonprofits",
    url: "https://example.com",
    ...overrides,
  };
}

export function makePage(
  overrides: Partial<SemanticPageModel> & { type?: SemanticPageType } = {},
): SemanticPageModel {
  return {
    type: overrides.type ?? "content",
    lang: "de",
    url: "https://example.com/de/page/",
    title: "Test Page",
    description: "A test page description",
    heading: "Test Heading",
    breadcrumbs: [
      { name: "Home", url: "https://example.com/de/" },
      { name: "Test Page", url: "https://example.com/de/page/" },
    ],
    blocks: [],
    organization: makeOrganization(),
    ...overrides,
  };
}
