import { describe, expect, it } from "vitest";
import { buildPageMarkdown } from "../page-markdown.ts";
import { makePage } from "./helpers.ts";

describe("buildPageMarkdown", () => {
  it("produces markdown with page title as h1", () => {
    const page = makePage({ title: "Test Page" });
    const result = buildPageMarkdown(page);
    expect(result).toContain("# Test Page");
  });

  it("includes Summary section from lead", () => {
    const page = makePage({ lead: "This is the lead text." });
    const result = buildPageMarkdown(page);
    expect(result).toContain("## Summary");
    expect(result).toContain("This is the lead text.");
  });

  it("falls back to description for summary", () => {
    const page = makePage({ description: "A test page description" });
    const result = buildPageMarkdown(page);
    expect(result).toContain("## Summary");
    expect(result).toContain("A test page description");
  });

  it("includes Business context section for generic blocks", () => {
    const page = makePage({
      blocks: [
        {
          id: "block-1",
          blockType: "prose",
          heading: "About Us",
          summary: "We are great.",
        },
      ],
    });
    const result = buildPageMarkdown(page);
    expect(result).toContain("## Business context");
    expect(result).toContain("### About Us");
    expect(result).toContain("We are great.");
  });

  it("classifies legal blocks as Constraints", () => {
    const page = makePage({
      blocks: [
        {
          id: "block-1",
          blockType: "prose",
          heading: "Legal Notice",
          summary: "Legal info.",
        },
      ],
    });
    const result = buildPageMarkdown(page);
    expect(result).toContain("## Constraints");
    expect(result).toContain("### Legal Notice");
  });

  it("includes People section when page has people", () => {
    const page = makePage({
      people: [{ name: "Jane Doe", role: "CEO", description: "Leader" }],
    });
    const result = buildPageMarkdown(page);
    expect(result).toContain("## People");
    expect(result).toContain("### Jane Doe");
    expect(result).toContain("**CEO**");
  });

  it("includes Initiatives section when page has initiatives", () => {
    const page = makePage({
      initiatives: [{ id: "init-1", name: "Project Alpha", summary: "A project" }],
    });
    const result = buildPageMarkdown(page);
    expect(result).toContain("## Initiatives");
    expect(result).toContain("Project Alpha");
  });

  it("includes FAQ section when page has faqEntries", () => {
    const page = makePage({
      faqEntries: [{ id: "q1", question: "What is this?", answer: "A test." }],
    });
    const result = buildPageMarkdown(page);
    expect(result).toContain("## FAQ");
    expect(result).toContain("### What is this?");
    expect(result).toContain("A test.");
  });

  it("collapses excessive blank lines", () => {
    const page = makePage({
      blocks: [
        { id: "b1", blockType: "prose", heading: "Block 1", summary: "S1" },
        { id: "b2", blockType: "prose", heading: "Block 2", summary: "S2" },
      ],
    });
    const result = buildPageMarkdown(page);
    expect(result).not.toMatch(/\n{3,}/);
  });
});
