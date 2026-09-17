import { describe, expect, it } from "vitest";
import { buildWebPageNode } from "../webpage.ts";
import { createJsonLdContext } from "../context.ts";
import { makePage } from "../../tests/helpers.ts";

describe("buildWebPageNode", () => {
  it("builds WebPage node for content type", () => {
    const page = makePage({ type: "content" });
    const ctx = createJsonLdContext(page);
    const node = buildWebPageNode(ctx);
    expect(node["@type"]).toEqual(["WebPage"]);
    expect(node["@id"]).toBe(ctx.webpageId);
    expect(node.url).toBe(page.url);
    expect(node.name).toBe("Test Page");
    expect(node.description).toBe("A test page description");
    expect(node.inLanguage).toBe("de");
  });

  it("uses heading for name when available", () => {
    const page = makePage({ heading: "Custom Heading" });
    const ctx = createJsonLdContext(page);
    const node = buildWebPageNode(ctx);
    expect(node.headline).toBe("Custom Heading");
  });

  it("uses title for headline", () => {
    const page = makePage({ title: "Page Title" });
    const ctx = createJsonLdContext(page);
    const node = buildWebPageNode(ctx);
    expect(node.name).toBe("Page Title");
  });

  it("emits CollectionPage for collection type", () => {
    const page = makePage({ type: "collection" });
    const ctx = createJsonLdContext(page);
    const node = buildWebPageNode(ctx);
    expect(node["@type"]).toEqual(["WebPage", "CollectionPage"]);
  });

  it("emits AboutPage for about type", () => {
    const page = makePage({ type: "about" });
    const ctx = createJsonLdContext(page);
    const node = buildWebPageNode(ctx);
    expect(node["@type"]).toEqual(["WebPage", "AboutPage"]);
  });

  it("emits ProfilePage for person type", () => {
    const page = makePage({ type: "person" });
    const ctx = createJsonLdContext(page);
    const node = buildWebPageNode(ctx);
    expect(node["@type"]).toEqual(["WebPage", "ProfilePage"]);
  });

  it("links to organization via publisher", () => {
    const page = makePage();
    const ctx = createJsonLdContext(page);
    const node = buildWebPageNode(ctx);
    expect(node.publisher).toEqual({ "@id": ctx.ids.organization });
  });

  it("links to breadcrumb when breadcrumbs > 1", () => {
    const page = makePage({
      breadcrumbs: [
        { name: "Home", url: "https://example.com/de/" },
        { name: "Page", url: "https://example.com/de/page/" },
      ],
    });
    const ctx = createJsonLdContext(page);
    const node = buildWebPageNode(ctx);
    expect(node.breadcrumb).toEqual({ "@id": ctx.breadcrumbId });
  });

  it("omits breadcrumb when only one crumb", () => {
    const page = makePage({
      breadcrumbs: [{ name: "Home", url: "https://example.com/de/" }],
    });
    const ctx = createJsonLdContext(page);
    const node = buildWebPageNode(ctx);
    expect(node.breadcrumb).toBeUndefined();
  });

  it("emits primaryImage when present", () => {
    const page = makePage({
      primaryImage: { url: "https://example.com/img.jpg" },
    });
    const ctx = createJsonLdContext(page);
    const node = buildWebPageNode(ctx);
    expect(node.primaryImageOfPage).toEqual({
      "@type": "ImageObject",
      url: "https://example.com/img.jpg",
    });
  });
});
