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
