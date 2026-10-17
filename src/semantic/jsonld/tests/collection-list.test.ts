/*
<MODULE_CONTRACT>
<purpose>
Unit tests for collection list covering buildCollectionListNode. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the collection suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

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
