import { describe, expect, it } from "vitest";
import { buildSemanticPageModelWith } from "../build-page.ts";
import type { SemanticContentReader } from "../build-page.ts";

function makeReader(overrides: Partial<SemanticContentReader> = {}): SemanticContentReader {
  return {
    getPageFrontmatter: async () => ({
      title: "Test Page",
      description: "A test page",
      blocks: [],
    }),
    getProseBody: async () => "",
    getHomeLabel: async () => "Home",
    getFaqEntries: async () => [],
    getDerivedPrices: () => null,
    ...overrides,
  };
}

const baseArgs = {
  pageId: "test-page",
  semanticType: "content" as const,
  lang: "de",
  url: "https://example.com/de/page/",
  profile: {
    organization: { name: "Org", description: "Desc", url: "https://example.com" },
    people: [],
    initiatives: [],
  },
};

describe("buildSemanticPageModelWith", () => {
  it("builds a SemanticPageModel from reader frontmatter", async () => {
    const reader = makeReader();
    const result = await buildSemanticPageModelWith(reader, baseArgs);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Test Page");
    expect(result!.description).toBe("A test page");
    expect(result!.lang).toBe("de");
  });

  it("returns null when reader returns null frontmatter and no fallback", async () => {
    const reader = makeReader({ getPageFrontmatter: async () => null });
    const result = await buildSemanticPageModelWith(reader, baseArgs);
    expect(result).toBeNull();
  });

  it("uses fallbackFrontmatter when reader returns null", async () => {
    const reader = makeReader({ getPageFrontmatter: async () => null });
    const result = await buildSemanticPageModelWith(reader, {
      ...baseArgs,
      fallbackFrontmatter: { title: "Fallback", description: "Fallback desc", blocks: [] },
    });
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Fallback");
  });

  it("attaches people for about pages", async () => {
    const reader = makeReader();
    const result = await buildSemanticPageModelWith(reader, {
      ...baseArgs,
      semanticType: "about",
      profile: {
        organization: { name: "Org", description: "Desc", url: "https://example.com" },
        people: [{ name: "Jane", role: "CEO" }],
        initiatives: [],
      },
    });
    expect(result!.people).toEqual([{ name: "Jane", role: "CEO" }]);
  });

  it("attaches initiatives for projects pages", async () => {
    const reader = makeReader();
    const result = await buildSemanticPageModelWith(reader, {
      ...baseArgs,
      semanticType: "projects",
      profile: {
        organization: { name: "Org", description: "Desc", url: "https://example.com" },
        people: [],
        initiatives: [{ id: "i1", name: "Project", summary: "A project" }],
      },
    });
    expect(result!.initiatives).toEqual([{ id: "i1", name: "Project", summary: "A project" }]);
  });

  it("attaches FAQ entries for donationContact pages", async () => {
    const reader = makeReader({
      getFaqEntries: async () => [{ id: "q1", question: "Q?", answer: "A." }],
    });
    const result = await buildSemanticPageModelWith(reader, {
      ...baseArgs,
      semanticType: "donationContact",
    });
    expect(result!.faqEntries).toEqual([{ id: "q1", question: "Q?", answer: "A." }]);
  });

  it("uses provided breadcrumbs when supplied", async () => {
    const reader = makeReader();
    const result = await buildSemanticPageModelWith(reader, {
      ...baseArgs,
      breadcrumbs: [
        { name: "Home", url: "https://example.com/de/" },
        { name: "Section", url: "https://example.com/de/section/" },
        { name: "Page", url: "https://example.com/de/page/" },
      ],
    });
    expect(result!.breadcrumbs).toHaveLength(3);
  });

  it("resolves price markers in heading and description", async () => {
    const reader = makeReader({
      getPageFrontmatter: async () => ({
        title: "Pricing",
        description: "Cost: {amount:50}",
        blocks: [],
      }),
    });
    const result = await buildSemanticPageModelWith(reader, baseArgs);
    expect(result!.description).toContain("€");
    expect(result!.description).not.toContain("{amount:");
  });
});
