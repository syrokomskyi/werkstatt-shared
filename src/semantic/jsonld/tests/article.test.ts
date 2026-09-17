import { describe, expect, it } from "vitest";
import { buildArticleNode } from "../article.ts";
import { createJsonLdContext } from "../context.ts";
import { makePage } from "../../tests/helpers.ts";

describe("buildArticleNode", () => {
  it("returns null when page has no datePublished", () => {
    const page = makePage();
    const ctx = createJsonLdContext(page);
    expect(buildArticleNode(ctx)).toBeNull();
  });

  it("builds Article/BlogPosting node with datePublished", () => {
    const page = makePage({ datePublished: "2024-01-15" });
    const ctx = createJsonLdContext(page);
    const node = buildArticleNode(ctx);
    expect(node).not.toBeNull();
    expect(node!["@type"]).toEqual(["Article", "BlogPosting"]);
    expect(node!.datePublished).toBe("2024-01-15");
    expect(node!.dateModified).toBe("2024-01-15");
    expect(node!.headline).toBe("Test Heading");
    expect(node!.inLanguage).toBe("de");
    expect(node!.publisher).toEqual({ "@id": ctx.ids.organization });
  });

  it("uses dateModified when provided", () => {
    const page = makePage({ datePublished: "2024-01-15", dateModified: "2024-06-01" });
    const ctx = createJsonLdContext(page);
    const node = buildArticleNode(ctx);
    expect(node!.dateModified).toBe("2024-06-01");
  });

  it("emits author as Person when author string is present", () => {
    const page = makePage({ datePublished: "2024-01-15", author: "Jane Doe" });
    const ctx = createJsonLdContext(page);
    const node = buildArticleNode(ctx);
    expect(node!.author).toEqual({ "@type": "Person", name: "Jane Doe" });
  });

  it("emits structured author from authorRecord", () => {
    const page = makePage({
      datePublished: "2024-01-15",
      authorRecord: { name: "Jane Doe", contactUrl: "https://example.com/contact" },
    });
    const ctx = createJsonLdContext(page);
    const node = buildArticleNode(ctx);
    expect(node!.author).toEqual({
      "@type": "Person",
      name: "Jane Doe",
      url: "https://example.com/contact",
    });
  });

  it("emits keywords as comma-separated string", () => {
    const page = makePage({ datePublished: "2024-01-15", keywords: ["foo", "bar"] });
    const ctx = createJsonLdContext(page);
    const node = buildArticleNode(ctx);
    expect(node!.keywords).toBe("foo, bar");
  });

  it("emits image from primaryImage", () => {
    const page = makePage({
      datePublished: "2024-01-15",
      primaryImage: { url: "https://example.com/img.jpg" },
    });
    const ctx = createJsonLdContext(page);
    const node = buildArticleNode(ctx);
    expect(node!.image).toBe("https://example.com/img.jpg");
  });

  it("uses page URL as mainEntityOfPage for ratgeber depth-1", () => {
    const page = makePage({
      datePublished: "2024-01-15",
      surfaceId: "ratgeber",
      depth: 1,
      url: "https://example.com/de/ratgeber/article/",
    });
    const ctx = createJsonLdContext(page);
    const node = buildArticleNode(ctx);
    expect(node!.mainEntityOfPage).toBe("https://example.com/de/ratgeber/article/");
  });

  it("uses webpage @id as mainEntityOfPage for non-ratgeber pages", () => {
    const page = makePage({ datePublished: "2024-01-15" });
    const ctx = createJsonLdContext(page);
    const node = buildArticleNode(ctx);
    expect(node!.mainEntityOfPage).toEqual({ "@id": ctx.webpageId });
  });
});
