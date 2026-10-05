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

  it("RFC-1197: merges inline faq-list items with tag-filtered collection entries", async () => {
    const reader = makeReader({
      getPageFrontmatter: async () => ({
        title: "Baked",
        description: "baked page",
        blocks: [
          {
            id: "city-qa",
            type: "faq-list",
            props: {
              header: { heading: "Fragen" },
              items: [
                { question: "Inline Q?", answer: "Inline A." },
                { question: "Inline Q2?", answer: "Inline A2." },
              ],
            },
          },
        ],
      }),
      getFaqEntries: async () => [
        { id: "faq/c1", question: "C1?", answer: "C1.", tags: ["contact"] },
        { id: "faq/c2", question: "C2?", answer: "C2.", tags: ["pricing"] },
      ],
    });
    const result = await buildSemanticPageModelWith(reader, baseArgs);
    expect(
      result!.faqEntries,
      "no tag on the block -> all collection entries + inline items after",
    ).toEqual([
      { id: "faq/c1", question: "C1?", answer: "C1.", tags: ["contact"] },
      { id: "faq/c2", question: "C2?", answer: "C2.", tags: ["pricing"] },
      { id: "faq/city-qa-0", question: "Inline Q?", answer: "Inline A." },
      { id: "faq/city-qa-1", question: "Inline Q2?", answer: "Inline A2." },
    ]);
  });

  it("RFC-1197: emits FAQPage from inline items alone when the collection is empty", async () => {
    const reader = makeReader({
      getPageFrontmatter: async () => ({
        title: "Baked",
        description: "baked page",
        blocks: [
          {
            id: "city-qa",
            type: "faq-list",
            props: {
              header: { heading: "Fragen" },
              items: [{ question: "Inline Q?", answer: "Inline A." }],
            },
          },
        ],
      }),
      getFaqEntries: async () => [],
    });
    const result = await buildSemanticPageModelWith(reader, baseArgs);
    expect(
      result!.faqEntries,
      "empty collection must not suppress inline Q&A — pSEO pages rely on it",
    ).toEqual([{ id: "faq/city-qa-0", question: "Inline Q?", answer: "Inline A." }]);
  });

  it("RFC-1197: empty tag-filter no longer suppresses the FAQPage when inline items exist", async () => {
    const reader = makeReader({
      getPageFrontmatter: async () => ({
        title: "Baked",
        description: "baked page",
        blocks: [
          {
            id: "city-qa",
            type: "faq-list",
            props: {
              header: { heading: "Fragen" },
              tag: "nothing-matches",
              items: [{ question: "Inline Q?", answer: "Inline A." }],
            },
          },
        ],
      }),
      getFaqEntries: async () => [
        { id: "faq/c1", question: "C1?", answer: "C1.", tags: ["contact"] },
      ],
    });
    const result = await buildSemanticPageModelWith(reader, baseArgs);
    expect(result!.faqEntries).toEqual([
      { id: "faq/city-qa-0", question: "Inline Q?", answer: "Inline A." },
    ]);
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
