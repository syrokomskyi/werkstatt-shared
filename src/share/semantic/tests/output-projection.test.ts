import { describe, expect, it } from "vitest";
import { resolvePageOutput } from "../output-projection.ts";

describe("resolvePageOutput", () => {
  it("returns defaults for undefined input", () => {
    const result = resolvePageOutput(undefined);
    expect(result.sitemap.include).toBe(true);
    expect(result.sitemap.category).toBe("content");
    expect(result.sitemap.includeLastmod).toBe(true);
    expect(result.robots.index).toBe(true);
    expect(result.robots.follow).toBe(true);
    expect(result.llms.depth).toBe("full");
  });

  it("handles sitemap: false boolean shorthand", () => {
    const result = resolvePageOutput({ sitemap: false });
    expect(result.sitemap.include).toBe(false);
  });

  it("handles sitemap object form", () => {
    const result = resolvePageOutput({
      sitemap: { include: false, category: "custom", lastmod: "2024-01-01", includeLastmod: false },
    });
    expect(result.sitemap.include).toBe(false);
    expect(result.sitemap.category).toBe("custom");
    expect(result.sitemap.lastmod).toBe("2024-01-01");
    expect(result.sitemap.includeLastmod).toBe(false);
  });

  it("uses legal category for legal semanticType", () => {
    const result = resolvePageOutput({}, { semanticType: "legal" });
    expect(result.sitemap.category).toBe("legal");
  });

  it("handles robots: false boolean shorthand", () => {
    const result = resolvePageOutput({ robots: false });
    expect(result.robots.index).toBe(false);
    expect(result.robots.follow).toBe(false);
  });

  it("handles robots object form", () => {
    const result = resolvePageOutput({ robots: { index: false, follow: true } });
    expect(result.robots.index).toBe(false);
    expect(result.robots.follow).toBe(true);
  });

  it("handles llms string shorthand", () => {
    const result = resolvePageOutput({ llms: "index-only" });
    expect(result.llms.depth).toBe("index-only");
  });

  it("handles llms object form with sections", () => {
    const result = resolvePageOutput({
      llms: { depth: "summary", sections: { exclude: ["section-1", "section-2"] } },
    });
    expect(result.llms.depth).toBe("summary");
    expect(result.llms.sections?.exclude).toEqual(["section-1", "section-2"]);
  });

  it("resolves content image", () => {
    const result = resolvePageOutput({
      image: { url: "https://example.com/img.jpg", alt: "Test", width: 800, height: 600 },
    });
    expect(result.image).toEqual({
      url: "https://example.com/img.jpg",
      alt: "Test",
      width: 800,
      height: 600,
      contentImage: true,
    });
  });

  it("omits image when url is empty", () => {
    const result = resolvePageOutput({ image: { url: "" } });
    expect(result.image).toBeUndefined();
  });
});
