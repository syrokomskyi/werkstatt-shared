import { describe, expect, it } from "vitest";
import {
  extractEmail,
  extractListFacts,
  extractLists,
  extractParagraphs,
  extractPostalAddress,
  mergePeople,
  normalizeWhitespace,
  splitMarkdownSections,
  splitSentences,
} from "../extract.ts";

describe("normalizeWhitespace", () => {
  it("collapses multiple spaces", () => {
    expect(normalizeWhitespace("a   b\n  c")).toBe("a b c");
  });
});

describe("splitMarkdownSections", () => {
  it("splits by h2 headings", () => {
    const md = "## Section 1\n\nBody 1\n\n## Section 2\n\nBody 2";
    const sections = splitMarkdownSections(md);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toEqual({ heading: "Section 1", body: "Body 1" });
    expect(sections[1]).toEqual({ heading: "Section 2", body: "Body 2" });
  });

  it("splits by h3 when level=3", () => {
    const md = "### Sub 1\n\nBody 1\n\n### Sub 2\n\nBody 2";
    const sections = splitMarkdownSections(md, 3);
    expect(sections).toHaveLength(2);
    expect(sections[0].heading).toBe("Sub 1");
  });

  it("returns empty for empty input", () => {
    expect(splitMarkdownSections("")).toEqual([]);
  });
});

describe("extractParagraphs", () => {
  it("splits on blank lines", () => {
    expect(extractParagraphs("Para 1\n\nPara 2\n\nPara 3")).toEqual(["Para 1", "Para 2", "Para 3"]);
  });
});

describe("splitSentences", () => {
  it("splits on period + space + capital", () => {
    expect(splitSentences("Hello world. Next sentence.")).toEqual([
      "Hello world.",
      "Next sentence.",
    ]);
  });

  it("handles German abbreviations", () => {
    const result = splitSentences("Das ist z.B. ein Test. Und noch einer.", "de");
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("z.B.");
  });

  it("handles English abbreviations", () => {
    const result = splitSentences("See e.g. the docs. For more info.", "en");
    expect(result).toHaveLength(2);
  });

  it("skips numbered list markers", () => {
    const result = splitSentences("1. First item 2. Second item", "en");
    expect(result).toHaveLength(1);
  });

  it("returns empty for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
});

describe("extractListFacts", () => {
  it("extracts bullet list items", () => {
    expect(extractListFacts("- Item 1\n- Item 2")).toEqual(["Item 1", "Item 2"]);
  });

  it("extracts numbered list items", () => {
    expect(extractListFacts("1. First\n2. Second")).toEqual(["First", "Second"]);
  });
});

describe("extractLists", () => {
  it("extracts a single bullet list with dash marker", () => {
    const result = extractLists("- Item 1\n- Item 2\n- Item 3");
    expect(result).toEqual([{ marker: "-", items: ["Item 1", "Item 2", "Item 3"] }]);
  });

  it("extracts a single bullet list with asterisk marker", () => {
    const result = extractLists("* Item 1\n* Item 2");
    expect(result).toEqual([{ marker: "*", items: ["Item 1", "Item 2"] }]);
  });

  it("extracts a single bullet list with plus marker", () => {
    const result = extractLists("+ Item 1\n+ Item 2");
    expect(result).toEqual([{ marker: "+", items: ["Item 1", "Item 2"] }]);
  });

  it("extracts an ordered list with digit marker", () => {
    const result = extractLists("1. First\n2. Second\n3. Third");
    expect(result).toEqual([{ marker: "digit", items: ["First", "Second", "Third"] }]);
  });

  it("groups consecutive list lines into a single list", () => {
    const md = "- Alpha\n- Beta\n- Gamma";
    const result = extractLists(md);
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(3);
  });

  it("terminates list on blank line", () => {
    const md = "- Item 1\n- Item 2\n\nProse text";
    const result = extractLists(md);
    expect(result).toHaveLength(1);
    expect(result[0].items).toEqual(["Item 1", "Item 2"]);
  });

  it("terminates list on non-list line", () => {
    const md = "- Item 1\n- Item 2\nSome prose line";
    const result = extractLists(md);
    expect(result).toHaveLength(1);
    expect(result[0].items).toEqual(["Item 1", "Item 2"]);
  });

  it("separates lists broken by prose", () => {
    const md = "- List 1 item\n\nSome prose\n\n- List 2 item";
    const result = extractLists(md);
    expect(result).toHaveLength(2);
    expect(result[0].items).toEqual(["List 1 item"]);
    expect(result[1].items).toEqual(["List 2 item"]);
  });

  it("skips lines inside fenced code blocks", () => {
    const md = "- Real item\n\n```text\n- Not a list item\n- Also not\n```\n\n- Another real item";
    const result = extractLists(md);
    expect(result).toHaveLength(2);
    expect(result[0].items).toEqual(["Real item"]);
    expect(result[1].items).toEqual(["Another real item"]);
  });

  it("skips indented (nested) list lines — they do not start a new list", () => {
    const md = "- Top level\n  - Nested item\n  - Another nested\n- Top level 2";
    const result = extractLists(md);
    expect(result).toHaveLength(1);
    expect(result[0].items).toEqual(["Top level", "Top level 2"]);
  });

  it("returns empty array for empty input", () => {
    expect(extractLists("")).toEqual([]);
  });

  it("returns empty array for prose with no lists", () => {
    expect(extractLists("Just some prose. No lists here.")).toEqual([]);
  });

  it("separates lists with different marker types", () => {
    const md = "- Dash item\n* Star item";
    const result = extractLists(md);
    expect(result).toHaveLength(2);
    expect(result[0].marker).toBe("-");
    expect(result[1].marker).toBe("*");
  });
});

describe("extractEmail", () => {
  it("extracts email from text", () => {
    expect(extractEmail("Contact us at info@example.com today")).toBe("info@example.com");
  });

  it("returns undefined when no email", () => {
    expect(extractEmail("No email here")).toBeUndefined();
  });
});

describe("extractPostalAddress", () => {
  it("extracts address with ZIP", () => {
    const result = extractPostalAddress("Test Str. 1, 12345 Berlin");
    expect(result).toEqual({
      streetAddress: "Test Str. 1",
      postalCode: "12345",
      addressLocality: "Berlin",
      addressCountry: "DE",
    });
  });

  it("returns undefined when no match", () => {
    expect(extractPostalAddress("No address here")).toBeUndefined();
  });
});

describe("mergePeople", () => {
  it("merges and deduplicates by name", () => {
    const result = mergePeople(
      [{ name: "Jane", role: "Founder" }],
      [{ name: "Jane", description: "Bio" }, { name: "John" }],
    );
    expect(result).toHaveLength(2);
    const jane = result.find((p) => p.name === "Jane");
    expect(jane?.role).toBe("Founder");
    expect(jane?.description).toBe("Bio");
  });

  it("handles undefined groups", () => {
    expect(mergePeople(undefined, [{ name: "A" }])).toEqual([{ name: "A" }]);
  });
});
