import { describe, expect, it } from "vitest";
import {
  generateImageSitemapXml,
  harvestContentImage,
  isHtmlRedirectPage,
  isSyntheticPreviewUrl,
} from "../image-sitemap.ts";

describe("isHtmlRedirectPage", () => {
  it("detects meta-refresh redirect", () => {
    expect(isHtmlRedirectPage('<meta http-equiv="refresh" content="0;url=/de/">')).toBe(true);
  });

  it("returns false for normal pages", () => {
    expect(isHtmlRedirectPage("<html><body>Hello</body></html>")).toBe(false);
  });
});

describe("isSyntheticPreviewUrl", () => {
  it("detects preview screenshots", () => {
    expect(isSyntheticPreviewUrl("https://example.com/preview/page.png")).toBe(true);
  });

  it("detects og-image fallback", () => {
    expect(isSyntheticPreviewUrl("https://example.com/og-image.png")).toBe(true);
  });

  it("returns false for content images", () => {
    expect(isSyntheticPreviewUrl("https://example.com/_astro/img.jpg")).toBe(false);
  });
});

describe("harvestContentImage", () => {
  it("extracts canonical URL from link tag", () => {
    const html = '<link rel="canonical" href="https://example.com/de/page" />';
    const result = harvestContentImage(html, "https://example.com");
    expect(result.loc).toBe("https://example.com/de/page");
  });

  it("returns null loc when no canonical", () => {
    const result = harvestContentImage("<html></html>", "https://example.com");
    expect(result.loc).toBeNull();
  });

  it("harvests img with data-content-image attribute", () => {
    const html = '<img src="/_astro/hero.jpg" data-content-image alt="Hero" />';
    const result = harvestContentImage(html, "https://example.com");
    expect(result.imageUrls).toContain("https://example.com/_astro/hero.jpg");
    expect(result.title).toBe("Hero");
  });

  it("harvests meta x-content-image", () => {
    const html = '<meta name="x-content-image" content="https://example.com/img.jpg" />';
    const result = harvestContentImage(html, "https://example.com");
    expect(result.imageUrls).toContain("https://example.com/img.jpg");
  });

  it("excludes synthetic preview URLs", () => {
    const html = '<img src="/og-image.png" data-content-image alt="OG" />';
    const result = harvestContentImage(html, "https://example.com");
    expect(result.imageUrls).toHaveLength(0);
  });

  it("deduplicates identical URLs", () => {
    const html = `
      <img src="/img.jpg" data-content-image alt="A" />
      <meta name="x-content-image" content="/img.jpg" />
    `;
    const result = harvestContentImage(html, "https://example.com");
    expect(result.imageUrls).toHaveLength(1);
  });

  it("falls back to og:image:alt for title", () => {
    const html = `
      <img src="/img.jpg" data-content-image />
      <meta property="og:image:alt" content="OG Alt" />
    `;
    const result = harvestContentImage(html, "https://example.com");
    expect(result.title).toBe("OG Alt");
  });
});

describe("generateImageSitemapXml", () => {
  it("produces valid image sitemap XML", () => {
    const result = generateImageSitemapXml([
      { loc: "https://example.com/page", imageUrl: "https://example.com/img.jpg", title: "Test" },
    ]);
    expect(result).toContain('<?xml version="1.0"');
    expect(result).toContain("<urlset");
    expect(result).toContain("xmlns:image=");
    expect(result).toContain("<loc>https://example.com/page</loc>");
    expect(result).toContain("<image:loc>https://example.com/img.jpg</image:loc>");
    expect(result).toContain("<image:title>Test</image:title>");
  });

  it("produces empty urlset for no entries", () => {
    const result = generateImageSitemapXml([]);
    expect(result).toContain("<urlset");
    expect(result).not.toContain("<url>");
  });

  it("escapes XML in URLs", () => {
    const result = generateImageSitemapXml([
      { loc: "https://example.com/a&b", imageUrl: "https://example.com/<img>" },
    ]);
    expect(result).toContain("a&amp;b");
    expect(result).toContain("&lt;img&gt;");
  });
});
