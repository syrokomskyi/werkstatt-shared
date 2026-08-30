import { describe, it, expect } from "vitest";
import {
  buildSearchManifest,
  computeSearchManifestContentHash,
  SEARCH_EMBEDDING_MODEL,
  SEARCH_EMBEDDING_DIMENSIONS,
  SEARCH_MANIFEST_SCHEMA_VERSION,
  SEARCH_CHUNK_TEXT_MAX_LENGTH,
  isNonKnowledgeFile,
  NON_KNOWLEDGE_FILES,
  type SearchChunk,
} from "./search.ts";

const baseChunk: SearchChunk = {
  id: "de:/about:block-intro",
  url: "/about",
  lang: "de",
  type: "page",
  blockId: "block-intro",
  heading: "About",
  text: "About the company",
};

describe("buildSearchManifest", () => {
  it("produces a manifest with correct schema version and model", () => {
    const manifest = buildSearchManifest({
      site: "test-site",
      model: SEARCH_EMBEDDING_MODEL,
      dimensions: SEARCH_EMBEDDING_DIMENSIONS,
      generatedAt: "2026-08-27T00:00:00Z",
      chunks: [baseChunk],
    });
    expect(manifest.schema).toBe(SEARCH_MANIFEST_SCHEMA_VERSION);
    expect(manifest.model).toBe(SEARCH_EMBEDDING_MODEL);
    expect(manifest.dimensions).toBe(SEARCH_EMBEDDING_DIMENSIONS);
  });

  it("sorts chunks by id for deterministic output", () => {
    const chunkB: SearchChunk = { ...baseChunk, id: "de:/about:block-zzz" };
    const chunkA: SearchChunk = { ...baseChunk, id: "de:/about:block-aaa" };
    const manifest = buildSearchManifest({
      site: "test-site",
      model: SEARCH_EMBEDDING_MODEL,
      dimensions: SEARCH_EMBEDDING_DIMENSIONS,
      generatedAt: "2026-08-27T00:00:00Z",
      chunks: [chunkB, chunkA],
    });
    expect(manifest.chunks[0].id).toBe("de:/about:block-aaa");
    expect(manifest.chunks[1].id).toBe("de:/about:block-zzz");
  });

  it("is deterministic — same input produces same contentHash regardless of chunk order", () => {
    const chunkA: SearchChunk = { ...baseChunk, id: "aaa" };
    const chunkB: SearchChunk = { ...baseChunk, id: "bbb" };
    const m1 = buildSearchManifest({
      site: "test-site",
      model: SEARCH_EMBEDDING_MODEL,
      dimensions: SEARCH_EMBEDDING_DIMENSIONS,
      generatedAt: "2026-08-27T00:00:00Z",
      chunks: [chunkA, chunkB],
    });
    const m2 = buildSearchManifest({
      site: "test-site",
      model: SEARCH_EMBEDDING_MODEL,
      dimensions: SEARCH_EMBEDDING_DIMENSIONS,
      generatedAt: "2026-08-28T00:00:00Z",
      chunks: [chunkB, chunkA],
    });
    expect(m1.contentHash).toBe(m2.contentHash);
  });

  it("excludes generatedAt from contentHash", () => {
    const m1 = buildSearchManifest({
      site: "test-site",
      model: SEARCH_EMBEDDING_MODEL,
      dimensions: SEARCH_EMBEDDING_DIMENSIONS,
      generatedAt: "2026-08-27T00:00:00Z",
      chunks: [baseChunk],
    });
    const m2 = buildSearchManifest({
      site: "test-site",
      model: SEARCH_EMBEDDING_MODEL,
      dimensions: SEARCH_EMBEDDING_DIMENSIONS,
      generatedAt: "2026-08-28T00:00:00Z",
      chunks: [baseChunk],
    });
    expect(m1.contentHash).toBe(m2.contentHash);
    expect(m1.generatedAt).not.toBe(m2.generatedAt);
  });

  it("produces different contentHash when chunks change", () => {
    const m1 = buildSearchManifest({
      site: "test-site",
      model: SEARCH_EMBEDDING_MODEL,
      dimensions: SEARCH_EMBEDDING_DIMENSIONS,
      generatedAt: "2026-08-27T00:00:00Z",
      chunks: [baseChunk],
    });
    const m2 = buildSearchManifest({
      site: "test-site",
      model: SEARCH_EMBEDDING_MODEL,
      dimensions: SEARCH_EMBEDDING_DIMENSIONS,
      generatedAt: "2026-08-27T00:00:00Z",
      chunks: [{ ...baseChunk, text: "Different text" }],
    });
    expect(m1.contentHash).not.toBe(m2.contentHash);
  });

  it("produces different contentHash when site changes", () => {
    const m1 = buildSearchManifest({
      site: "site-a",
      model: SEARCH_EMBEDDING_MODEL,
      dimensions: SEARCH_EMBEDDING_DIMENSIONS,
      generatedAt: "2026-08-27T00:00:00Z",
      chunks: [baseChunk],
    });
    const m2 = buildSearchManifest({
      site: "site-b",
      model: SEARCH_EMBEDDING_MODEL,
      dimensions: SEARCH_EMBEDDING_DIMENSIONS,
      generatedAt: "2026-08-27T00:00:00Z",
      chunks: [baseChunk],
    });
    expect(m1.contentHash).not.toBe(m2.contentHash);
  });
});

describe("computeSearchManifestContentHash", () => {
  it("matches the hash produced by buildSearchManifest", () => {
    const manifest = buildSearchManifest({
      site: "test-site",
      model: SEARCH_EMBEDDING_MODEL,
      dimensions: SEARCH_EMBEDDING_DIMENSIONS,
      generatedAt: "2026-08-27T00:00:00Z",
      chunks: [baseChunk],
    });
    const recomputed = computeSearchManifestContentHash(manifest);
    expect(recomputed).toBe(manifest.contentHash);
  });

  it("excludes proof from contentHash", () => {
    const manifest = buildSearchManifest({
      site: "test-site",
      model: SEARCH_EMBEDDING_MODEL,
      dimensions: SEARCH_EMBEDDING_DIMENSIONS,
      generatedAt: "2026-08-27T00:00:00Z",
      chunks: [baseChunk],
    });
    const withProof = {
      ...manifest,
      proof: {
        type: "Ed25519Signature2020",
        created: "2026-08-27T00:00:00Z",
        verificationMethod: "did:web:example.com#key-v1",
        proofPurpose: "assertionMethod",
        proofValue: "zFakeProofValue",
      },
    };
    expect(computeSearchManifestContentHash(withProof)).toBe(manifest.contentHash);
  });
});

describe("constants", () => {
  it("SEARCH_CHUNK_TEXT_MAX_LENGTH is 2000", () => {
    expect(SEARCH_CHUNK_TEXT_MAX_LENGTH).toBe(2000);
  });
});

describe("isNonKnowledgeFile", () => {
  it("returns true for search-manifest.json", () => {
    expect(isNonKnowledgeFile("search-manifest.json")).toBe(true);
  });

  it("returns false for knowledge domain files", () => {
    expect(isNonKnowledgeFile("company.json")).toBe(false);
    expect(isNonKnowledgeFile("offer.json")).toBe(false);
    expect(isNonKnowledgeFile("faq.json")).toBe(false);
  });

  it("returns false for arbitrary filenames", () => {
    expect(isNonKnowledgeFile("foo.json")).toBe(false);
    expect(isNonKnowledgeFile("readme.md")).toBe(false);
  });

  it("NON_KNOWLEDGE_FILES contains search-manifest.json", () => {
    expect(NON_KNOWLEDGE_FILES).toContain("search-manifest.json");
  });
});
