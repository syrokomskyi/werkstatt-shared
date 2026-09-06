import { describe, expect, it } from "vitest";
import {
  canonicalizeGeneratedMarkdownText,
  formatGeneratedMarkdownListItem,
  normalizeGeneratedMarkdownText,
} from "../markdown-hygiene.ts";

describe("normalizeGeneratedMarkdownText", () => {
  it("returns empty string for undefined", () => {
    expect(normalizeGeneratedMarkdownText(undefined)).toBe("");
  });

  it("normalizes CRLF to LF", () => {
    expect(normalizeGeneratedMarkdownText("a\r\nb")).toBe("a\nb");
  });

  it("converts <br> tags to newlines", () => {
    expect(normalizeGeneratedMarkdownText("a<br>b")).toBe("a\nb");
    expect(normalizeGeneratedMarkdownText("a<br/>b")).toBe("a\nb");
  });

  it("converts date slashes to ISO format", () => {
    expect(normalizeGeneratedMarkdownText("2024/1/5")).toBe("2024-01-05");
    expect(normalizeGeneratedMarkdownText("2024/12/15")).toBe("2024-12-15");
  });

  it("fixes - --- to ---", () => {
    expect(normalizeGeneratedMarkdownText("- ---\n")).toBe("---");
  });

  it("fixes - - to - ", () => {
    expect(normalizeGeneratedMarkdownText("- - item")).toBe("- item");
  });

  it("fixes - # to #", () => {
    expect(normalizeGeneratedMarkdownText("- ## Heading")).toBe("## Heading");
  });

  it("trims trailing whitespace", () => {
    expect(normalizeGeneratedMarkdownText("text   \n")).toBe("text");
  });
});

describe("canonicalizeGeneratedMarkdownText", () => {
  it("strips default language prefix from URLs", () => {
    const result = canonicalizeGeneratedMarkdownText("Link to [page](https://example.com/de/page)", {
      baseUrl: "https://example.com",
      defaultLanguage: "de",
    });
    expect(result).toBe("Link to [page](https://example.com/page)");
  });

  it("does not strip when no baseUrl/defaultLanguage", () => {
    const result = canonicalizeGeneratedMarkdownText("https://example.com/de/page");
    expect(result).toBe("https://example.com/de/page");
  });
});

describe("formatGeneratedMarkdownListItem", () => {
  it("wraps plain text as list item", () => {
    expect(formatGeneratedMarkdownListItem("Simple text")).toEqual(["- Simple text"]);
  });

  it("returns empty array for empty text", () => {
    expect(formatGeneratedMarkdownListItem("")).toEqual([]);
  });

  it("splits markdown blocks into lines", () => {
    const result = formatGeneratedMarkdownListItem("## Heading\n\nParagraph");
    expect(result).toEqual(["## Heading", "", "Paragraph"]);
  });
});
