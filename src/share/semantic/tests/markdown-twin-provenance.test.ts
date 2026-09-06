import { describe, expect, it } from "vitest";
import {
  AUDIENCE_BY_PAGE_TYPE,
  buildMarkdownTwin,
  buildMarkdownTwinFrontmatter,
  computeContentHash,
  parseMarkdownTwinFrontmatter,
  verifyMarkdownTwinHash,
  type MarkdownTwinProvenance,
} from "../markdown-twin-provenance.ts";

const baseProvenance: MarkdownTwinProvenance = {
  canonical: "https://example.com/de/page",
  language: "de",
  lastModified: "2024-01-15",
  license: "CC-BY-4.0",
  generator: "test",
  sourceKind: "authored",
};

describe("computeContentHash", () => {
  it("produces sha256: prefix", () => {
    expect(computeContentHash("body text").startsWith("sha256:")).toBe(true);
  });

  it("is deterministic for same input", () => {
    expect(computeContentHash("body")).toBe(computeContentHash("body"));
  });

  it("normalizes trailing whitespace", () => {
    expect(computeContentHash("body\n\n")).toBe(computeContentHash("body"));
  });

  it("normalizes CRLF to LF", () => {
    expect(computeContentHash("a\r\nb")).toBe(computeContentHash("a\nb"));
  });
});

describe("buildMarkdownTwinFrontmatter", () => {
  it("includes all core provenance fields", () => {
    const fm = buildMarkdownTwinFrontmatter(baseProvenance, "sha256:abc");
    expect(fm).toContain('canonical: "https://example.com/de/page"');
    expect(fm).toContain('language: "de"');
    expect(fm).toContain('lastModified: "2024-01-15"');
    expect(fm).toContain('contentHash: "sha256:abc"');
    expect(fm).toContain('license: "CC-BY-4.0"');
    expect(fm).toContain('generator: "test"');
    expect(fm).toContain('sourceKind: "authored"');
    expect(fm).toContain('schema: "gogol.markdown-twin@2"');
  });

  it("emits null for lastModified when null", () => {
    const fm = buildMarkdownTwinFrontmatter(
      { ...baseProvenance, lastModified: null },
      "sha256:abc",
    );
    expect(fm).toContain("lastModified: null");
  });

  it("includes pageId when provided", () => {
    const fm = buildMarkdownTwinFrontmatter(
      { ...baseProvenance, pageId: "about" },
      "sha256:abc",
    );
    expect(fm).toContain('pageId: "about"');
  });

  it("includes sourceInputs when provided", () => {
    const fm = buildMarkdownTwinFrontmatter(
      { ...baseProvenance, sourceInputs: ["file1.md", "file2.md"] },
      "sha256:abc",
    );
    expect(fm).toContain('sourceInputs:');
    expect(fm).toContain('"file1.md"');
  });

  it("includes semantic meta when provided", () => {
    const fm = buildMarkdownTwinFrontmatter(
      {
        ...baseProvenance,
        semantic: {
          id: "page-1",
          route: "/de/page",
          title: "Page",
          type: "content",
          domain: "content",
          audience: "general",
          lang: "de",
          metaDescription: "A page",
          priority: 0.7,
          tags: ["tag1"],
        },
      },
      "sha256:abc",
    );
    expect(fm).toContain('id: "page-1"');
    expect(fm).toContain('type: "content"');
    expect(fm).toContain("priority: 0.7");
  });
});

describe("buildMarkdownTwin", () => {
  it("produces frontmatter + body", () => {
    const twin = buildMarkdownTwin("# Hello\n\nWorld", baseProvenance);
    expect(twin.startsWith("---\n")).toBe(true);
    expect(twin).toContain("# Hello");
    expect(twin).toContain("World");
  });
});

describe("parseMarkdownTwinFrontmatter", () => {
  it("round-trips buildMarkdownTwin output", () => {
    const body = "# Hello\n\nWorld";
    const twin = buildMarkdownTwin(body, baseProvenance);
    const parsed = parseMarkdownTwinFrontmatter(twin);
    expect(parsed).not.toBeNull();
    expect(parsed!.frontmatter.canonical).toBe("https://example.com/de/page");
    expect(parsed!.frontmatter.language).toBe("de");
    expect(parsed!.body).toBe("# Hello\n\nWorld\n");
  });

  it("returns null for no frontmatter", () => {
    expect(parseMarkdownTwinFrontmatter("just text")).toBeNull();
  });
});

describe("verifyMarkdownTwinHash", () => {
  it("verifies correct hash", () => {
    const twin = buildMarkdownTwin("# Hello", baseProvenance);
    expect(verifyMarkdownTwinHash(twin)).toBe(true);
  });

  it("fails for tampered body", () => {
    const twin = buildMarkdownTwin("# Hello", baseProvenance);
    const tampered = twin.replace("# Hello", "# Tampered");
    expect(verifyMarkdownTwinHash(tampered)).toBe(false);
  });
});

describe("AUDIENCE_BY_PAGE_TYPE", () => {
  it("maps home to general", () => {
    expect(AUDIENCE_BY_PAGE_TYPE.home).toBe("general");
  });

  it("maps projects to developer", () => {
    expect(AUDIENCE_BY_PAGE_TYPE.projects).toBe("developer");
  });

  it("maps legal to business_owner", () => {
    expect(AUDIENCE_BY_PAGE_TYPE.legal).toBe("business_owner");
  });
});
