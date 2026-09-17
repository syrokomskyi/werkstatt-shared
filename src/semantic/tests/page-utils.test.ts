import { describe, expect, it } from "vitest";
import {
  blocksToMarkdown,
  extractAnswerBlocksFromMarkdown,
  toPageEntryId,
  toSemanticAnswerBlocks,
} from "../page-utils.ts";

describe("extractAnswerBlocksFromMarkdown", () => {
  it("extracts h2 sections with content", () => {
    const md = "## Section 1\n\nContent 1\n\n## Section 2\n\nContent 2";
    const blocks = extractAnswerBlocksFromMarkdown(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ heading: "Section 1", content: "Content 1" });
    expect(blocks[1]).toEqual({ heading: "Section 2", content: "Content 2" });
  });

  it("ignores content before first h2", () => {
    const md = "Intro text\n\n## Section\n\nContent";
    const blocks = extractAnswerBlocksFromMarkdown(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].heading).toBe("Section");
  });

  it("returns empty for no h2", () => {
    expect(extractAnswerBlocksFromMarkdown("Just text")).toEqual([]);
  });
});

describe("blocksToMarkdown", () => {
  it("converts blocks back to markdown", () => {
    const blocks = [
      { heading: "Section 1", content: "Content 1" },
      { heading: "Section 2", content: "Content 2" },
    ];
    expect(blocksToMarkdown(blocks)).toBe("## Section 1\n\nContent 1\n\n## Section 2\n\nContent 2");
  });
});

describe("toPageEntryId", () => {
  it("strips language prefix and .html", () => {
    expect(toPageEntryId(new URL("https://example.com/de/about.html"))).toBe("about");
  });

  it("handles nested paths", () => {
    expect(toPageEntryId(new URL("https://example.com/de/section/page"))).toBe("section-page");
  });

  it("returns index for root", () => {
    expect(toPageEntryId(new URL("https://example.com/de/"))).toBe("index");
  });
});

describe("toSemanticAnswerBlocks", () => {
  it("produces SemanticBlock with blockType prose", () => {
    const blocks = [{ heading: "Section", content: "Summary line\n- fact 1\n- fact 2" }];
    const result = toSemanticAnswerBlocks(blocks);
    expect(result).toHaveLength(1);
    expect(result[0].blockType).toBe("prose");
    expect(result[0].heading).toBe("Section");
    expect(result[0].summary).toBe("Summary line");
    expect(result[0].facts).toEqual(["- fact 1", "- fact 2"]);
  });

  it("preserves table content as summary", () => {
    const blocks = [
      {
        heading: "Pricing",
        content: "| Col1 | Col2 |\n| --- | --- |\n| a | b |",
      },
    ];
    const result = toSemanticAnswerBlocks(blocks);
    expect(result[0].summary).toContain("| Col1 | Col2 |");
    expect(result[0].facts).toBeUndefined();
  });

  it("preserves multi-paragraph content as summary", () => {
    const blocks = [
      {
        heading: "Section",
        content: "First paragraph.\n\nSecond paragraph.",
      },
    ];
    const result = toSemanticAnswerBlocks(blocks);
    expect(result[0].summary).toBe("First paragraph.\n\nSecond paragraph.");
    expect(result[0].facts).toBeUndefined();
  });
});
