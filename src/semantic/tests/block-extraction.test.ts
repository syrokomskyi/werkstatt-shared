/*
<MODULE_CONTRACT>
<purpose>
Unit tests for block extraction covering BlockExtractorRegistry; BLOCK_EXTRACTORS. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the block suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";
import { BlockExtractorRegistry, BLOCK_EXTRACTORS } from "../block-extraction.ts";
import "../block-extractors/index.ts";

describe("BlockExtractorRegistry", () => {
  it("registers and retrieves extractors", () => {
    const registry = new BlockExtractorRegistry();
    registry.register({
      blockType: "test-block",
      extract: () => ({ heading: "Test" }),
    });
    expect(registry.has("test-block")).toBe(true);
    expect(registry.get("test-block")?.blockType).toBe("test-block");
  });

  it("returns undefined for unregistered type", () => {
    const registry = new BlockExtractorRegistry();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("lists registered types", () => {
    const registry = new BlockExtractorRegistry();
    registry.register({ blockType: "a", extract: () => ({}) });
    registry.register({ blockType: "b", extract: () => ({}) });
    expect(registry.listTypes().sort()).toEqual(["a", "b"]);
  });
});

describe("BLOCK_EXTRACTORS", () => {
  it("is a registry instance with pre-registered extractors", () => {
    expect(BLOCK_EXTRACTORS).toBeInstanceOf(BlockExtractorRegistry);
    expect(BLOCK_EXTRACTORS.listTypes().length).toBeGreaterThan(0);
  });
});

describe("product-line-cards extractor", () => {
  it("extracts each line with its manufacturer attribution", () => {
    const result = BLOCK_EXTRACTORS.get("product-line-cards")?.extract({
      header: { heading: "Lines" },
      body: {
        kind: "product-lines",
        items: [
          { name: "Sandorini", attribution: "CMD Naturkosmetik", summary: "Sea buckthorn care" },
        ],
      },
    });
    expect(result).toEqual({
      heading: "Lines",
      lead: undefined,
      items: [{ title: "Sandorini (CMD Naturkosmetik)", description: "Sea buckthorn care" }],
    });
  });

  it("registers breadcrumbs as a content-free block", () => {
    expect(BLOCK_EXTRACTORS.get("breadcrumbs")?.extract({})).toEqual({});
  });
});
