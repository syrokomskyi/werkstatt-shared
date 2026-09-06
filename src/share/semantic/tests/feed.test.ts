import { describe, expect, it } from "vitest";
import { buildJsonFeed, buildRssFeed } from "../feed.ts";

const channel = {
  title: "Test Feed",
  url: "https://example.com",
  description: "A test feed",
  language: "de",
  selfUrl: "https://example.com/feed.xml",
};

const items = [
  { title: "Item 1", url: "https://example.com/1", summary: "Summary 1", publishedAt: "2024-01-01" },
  { title: "Item 2", url: "https://example.com/2", summary: "Summary 2", publishedAt: "2024-06-01" },
];

describe("buildRssFeed", () => {
  it("produces valid RSS XML", () => {
    const result = buildRssFeed(channel, items);
    expect(result).toContain('<?xml version="1.0"');
    expect(result).toContain("<rss version=\"2.0\"");
    expect(result).toContain("<channel>");
    expect(result).toContain("<title>Test Feed</title>");
    expect(result).toContain("<language>de</language>");
  });

  it("sorts items by publishedAt descending", () => {
    const result = buildRssFeed(channel, items);
    const item1Idx = result.indexOf("Item 1");
    const item2Idx = result.indexOf("Item 2");
    expect(item2Idx).toBeLessThan(item1Idx);
  });

  it("escapes XML special characters", () => {
    const result = buildRssFeed(channel, [
      { title: "A & B <C>", url: "https://example.com/x", summary: "S", publishedAt: "2024-01-01" },
    ]);
    expect(result).toContain("A &amp; B &lt;C&gt;");
  });

  it("includes atom self link", () => {
    const result = buildRssFeed(channel, items);
    expect(result).toContain('href="https://example.com/feed.xml"');
    expect(result).toContain('rel="self"');
  });

  it("derives lastBuildDate from latest item", () => {
    const result = buildRssFeed(channel, items);
    expect(result).toContain("<lastBuildDate>");
  });

  it("omits lastBuildDate for empty feed", () => {
    const result = buildRssFeed(channel, []);
    expect(result).not.toContain("<lastBuildDate>");
  });
});

describe("buildJsonFeed", () => {
  it("produces JSON Feed v1.1", () => {
    const result = buildJsonFeed({
      title: "Test Feed",
      home_page_url: "https://example.com",
      feed_url: "https://example.com/feed.json",
      description: "A test feed",
      language: "de",
      items,
    });
    const parsed = JSON.parse(result);
    expect(parsed.version).toBe("https://jsonfeed.org/version/1.1");
    expect(parsed.title).toBe("Test Feed");
    expect(parsed.items).toHaveLength(2);
  });

  it("sorts items by publishedAt descending", () => {
    const result = buildJsonFeed({
      title: "Test",
      home_page_url: "https://example.com",
      feed_url: "https://example.com/feed.json",
      description: "",
      language: "de",
      items,
    });
    const parsed = JSON.parse(result);
    expect(parsed.items[0].title).toBe("Item 2");
    expect(parsed.items[1].title).toBe("Item 1");
  });

  it("includes date_modified when updatedAt provided", () => {
    const result = buildJsonFeed({
      title: "Test",
      home_page_url: "https://example.com",
      feed_url: "https://example.com/feed.json",
      description: "",
      language: "de",
      items: [{ title: "T", url: "https://example.com/1", summary: "S", publishedAt: "2024-01-01", updatedAt: "2024-06-01" }],
    });
    const parsed = JSON.parse(result);
    expect(parsed.items[0].date_modified).toBe("2024-06-01");
  });

  it("omits items array for empty feed", () => {
    const result = buildJsonFeed({
      title: "Test",
      home_page_url: "https://example.com",
      feed_url: "https://example.com/feed.json",
      description: "",
      language: "de",
      items: [],
    });
    const parsed = JSON.parse(result);
    expect(parsed.items).toBeUndefined();
  });
});
