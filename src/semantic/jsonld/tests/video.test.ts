import { describe, expect, it } from "vitest";
import { buildVideoObjectNodes } from "../video.ts";
import { createJsonLdContext } from "../context.ts";
import { makePage } from "../../tests/helpers.ts";

describe("buildVideoObjectNodes", () => {
  it("returns empty array when no blocks have video data", () => {
    const page = makePage({ blocks: [{ id: "b1", heading: "Test" }] });
    const ctx = createJsonLdContext(page);
    expect(buildVideoObjectNodes(ctx)).toEqual([]);
  });

  it("builds VideoObject nodes for blocks with video data", () => {
    const page = makePage({
      blocks: [
        {
          id: "vid-1",
          heading: "Video Section",
          video: {
            seo: { name: "Intro Video", description: "An intro", uploadDate: "2024-01-15" },
            manifest: {
              posterUrl: "https://example.com/poster.jpg",
              contentUrl: "https://example.com/video.mp4",
              durationSec: 90,
            },
          },
        },
      ],
    });
    const ctx = createJsonLdContext(page);
    const nodes = buildVideoObjectNodes(ctx);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]["@type"]).toBe("VideoObject");
    expect(nodes[0].name).toBe("Intro Video");
    expect(nodes[0].description).toBe("An intro");
    expect(nodes[0].uploadDate).toBe("2024-01-15");
    expect(nodes[0].thumbnailUrl).toBe("https://example.com/poster.jpg");
    expect(nodes[0].contentUrl).toBe("https://example.com/video.mp4");
    expect(nodes[0].duration).toBe("PT1M30S");
  });

  it("formats duration correctly for hours, minutes, seconds", () => {
    const page = makePage({
      blocks: [
        {
          id: "vid-2",
          heading: "Long Video",
          video: {
            seo: { name: "Long", description: "Long", uploadDate: "2024-01-15" },
            manifest: {
              posterUrl: "https://example.com/p.jpg",
              contentUrl: "https://example.com/v.mp4",
              durationSec: 3661,
            },
          },
        },
      ],
    });
    const ctx = createJsonLdContext(page);
    const nodes = buildVideoObjectNodes(ctx);
    expect(nodes[0].duration).toBe("PT1H1M1S");
  });

  it("omits duration when durationSec is not provided", () => {
    const page = makePage({
      blocks: [
        {
          id: "vid-3",
          heading: "No Duration",
          video: {
            seo: { name: "NoDur", description: "No dur", uploadDate: "2024-01-15" },
            manifest: {
              posterUrl: "https://example.com/p.jpg",
              contentUrl: "https://example.com/v.mp4",
            },
          },
        },
      ],
    });
    const ctx = createJsonLdContext(page);
    const nodes = buildVideoObjectNodes(ctx);
    expect(nodes[0].duration).toBeUndefined();
  });
});
