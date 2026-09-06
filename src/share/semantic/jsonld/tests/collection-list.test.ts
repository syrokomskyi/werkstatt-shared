import { describe, expect, it } from "vitest";
import { buildCollectionListNode } from "../collection-list.ts";
import { createJsonLdContext } from "../context.ts";
import { makePage } from "../../tests/helpers.ts";

describe("buildCollectionListNode", () => {
  it("returns null when page is not collection type", () => {
    const page = makePage({ type: "content" });
    const ctx = createJsonLdContext(page);
    expect(buildCollectionListNode(ctx)).toBeNull();
  });

  it("returns null when collection has no items", () => {
    const page = makePage({ type: "collection", collectionItems: [] });
    const ctx = createJsonLdContext(page);
    expect(buildCollectionListNode(ctx)).toBeNull();
  });

  it("builds ItemList for collection page with items", () => {
    const page = makePage({
      type: "collection",
      collectionItems: [
        { url: "https://example.com/de/industry-a/", name: "Industry A" },
        { url: "https://example.com/de/industry-b/", name: "Industry B" },
      ],
    });
    const ctx = createJsonLdContext(page);
    const node = buildCollectionListNode(ctx);
    expect(node).not.toBeNull();
    expect(node!["@type"]).toBe("ItemList");
    expect(node!.itemListElement).toHaveLength(2);
    const items = (node as Record<string, unknown[]>).itemListElement as Record<string, unknown>[];
    expect(items[0]).toMatchObject({
      position: 1,
      url: "https://example.com/de/industry-a/",
      name: "Industry A",
    });
  });
});
