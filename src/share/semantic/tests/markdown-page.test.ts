import { describe, expect, it } from "vitest";
import { buildMarkdownPageSemantic } from "../page-builders/markdown-page.ts";

const baseInput = {
  type: "content" as const,
  lang: "de",
  url: "https://example.com/de/page/",
  title: "Test Page",
  description: "A test page",
  heading: "Test Heading",
  blocks: [],
};

describe("buildMarkdownPageSemantic", () => {
  it("builds a SemanticPageModel with canonical URL", () => {
    const result = buildMarkdownPageSemantic(baseInput);
    expect(result.type).toBe("content");
    expect(result.lang).toBe("de");
    expect(result.url).toBe("https://example.com/de/page/");
    expect(result.title).toBe("Test Page");
    expect(result.description).toBe("A test page");
    expect(result.heading).toBe("Test Heading");
  });

  it("builds flat breadcrumb fallback when no breadcrumbs provided", () => {
    const result = buildMarkdownPageSemantic({
      ...baseInput,
      breadcrumbsContent: { homeLabel: "Start" },
    });
    expect(result.breadcrumbs).toHaveLength(2);
    expect(result.breadcrumbs[0]).toEqual({ name: "Start", url: "https://example.com/de/" });
    expect(result.breadcrumbs[1]).toEqual({ name: "Test Heading", url: "https://example.com/de/page/" });
  });

  it("uses provided breadcrumbs when available", () => {
    const result = buildMarkdownPageSemantic({
      ...baseInput,
      breadcrumbs: [
        { name: "Home", url: "https://example.com/de/" },
        { name: "Section", url: "https://example.com/de/section/" },
        { name: "Page", url: "https://example.com/de/section/page/" },
      ],
    });
    expect(result.breadcrumbs).toHaveLength(3);
    expect(result.breadcrumbs[1]).toEqual({ name: "Section", url: "https://example.com/de/section/" });
  });

  it("passes through blocks", () => {
    const blocks = [{ id: "b1", blockType: "prose", heading: "Block 1" }];
    const result = buildMarkdownPageSemantic({ ...baseInput, blocks });
    expect(result.blocks).toBe(blocks);
  });

  it("passes through people and initiatives", () => {
    const result = buildMarkdownPageSemantic({
      ...baseInput,
      people: [{ name: "Jane", role: "CEO" }],
      initiatives: [{ id: "i1", name: "Project", summary: "A project" }],
    });
    expect(result.people).toEqual([{ name: "Jane", role: "CEO" }]);
    expect(result.initiatives).toEqual([{ id: "i1", name: "Project", summary: "A project" }]);
  });

  it("passes through faqEntries when provided", () => {
    const result = buildMarkdownPageSemantic({
      ...baseInput,
      faqEntries: [{ id: "q1", question: "Q?", answer: "A." }],
    });
    expect(result.faqEntries).toEqual([{ id: "q1", question: "Q?", answer: "A." }]);
  });

  it("sets faqEntries to undefined when empty", () => {
    const result = buildMarkdownPageSemantic({
      ...baseInput,
      faqEntries: [],
    });
    expect(result.faqEntries).toBeUndefined();
  });

  it("includes audience when provided", () => {
    const result = buildMarkdownPageSemantic({
      ...baseInput,
      audience: "developer",
    });
    expect(result.audience).toBe("developer");
  });

  it("omits audience when not provided", () => {
    const result = buildMarkdownPageSemantic(baseInput);
    expect(result.audience).toBeUndefined();
  });

  it("uses default Home label when no breadcrumbsContent", () => {
    const result = buildMarkdownPageSemantic(baseInput);
    expect(result.breadcrumbs[0].name).toBe("Home");
  });
});
