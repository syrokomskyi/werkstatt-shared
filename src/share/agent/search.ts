/*
<MODULE_CONTRACT>
<purpose>
RFC-0954: shared types and pure helpers for the agent semantic search capability.
Defines the search manifest shape (build-time output), query/response contracts
(runtime API), and pinned embedding model constants. Pure, deterministic — no I/O,
no timestamps in the hash payload.
</purpose>
<non-goals>
  <item>Do not read files or embed text — callers (kernel commands) load content and
        call buildSearchManifest with already-extracted chunks.</item>
  <item>Do not call Workers AI or Vectorize — runtime logic lives in agent-gate/astro.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0954: initial search manifest contract, query/response types, and pure builder.</item>
  <item>m000101: add NON_KNOWLEDGE_FILES and isNonKnowledgeFile for shared non-knowledge-file exclusion.</item>
</CHANGE_SUMMARY>
*/

import { createHash } from "node:crypto";
import { canonicalJson } from "./manifest.ts";

// ---------------------------------------------------------------------------
// Pinned embedding model constants (RFC-0954 §Embedding model)
// ---------------------------------------------------------------------------

/** Cloudflare Workers AI embedding model for semantic search (multilingual, 1024 dims). */
export const SEARCH_EMBEDDING_MODEL = "@cf/baai/bge-m3";

/** Vector dimensions for the pinned embedding model. */
export const SEARCH_EMBEDDING_DIMENSIONS = 1024;

/** Maximum number of results per query. */
export const SEARCH_MAX_TOP_K = 20;

/** Default number of results per query. */
export const SEARCH_DEFAULT_TOP_K = 5;

/** Maximum character length for a chunk's `text` field (truncated before embedding). */
export const SEARCH_CHUNK_TEXT_MAX_LENGTH = 2000;

/** Schema version for the search manifest. */
export const SEARCH_MANIFEST_SCHEMA_VERSION = "1";

/** Static asset path for the generated search manifest. */
export const SEARCH_MANIFEST_PATH = "public/api/agent/v1/search-manifest.json";

/**
 * Files that live in the knowledge directory (`public/api/agent/v1/`) but are NOT
 * knowledge envelopes. Used by `agent.knowledge.validate`, `agent.manifest.generate`,
 * `agent.surface.validate`, and `agent.search.manifest.generate` to skip non-knowledge
 * artifacts when iterating knowledge domain files.
 */
export const NON_KNOWLEDGE_FILES = ["search-manifest.json"] as const;

/** Returns true if `filename` is a non-knowledge file that lives in the knowledge directory. */
export function isNonKnowledgeFile(filename: string): boolean {
  return (NON_KNOWLEDGE_FILES as readonly string[]).includes(filename);
}

// ---------------------------------------------------------------------------
// Search manifest (build-time output)
// ---------------------------------------------------------------------------

/** Content type of a search chunk. */
export type SearchChunkType = "page" | "knowledge" | "faq" | "prose";

/** A single searchable content unit — one per block, knowledge entry, or FAQ entry. */
export interface SearchChunk {
  /** Deterministic ID: "{lang}:{urlPath}:{blockId}" or "{lang}:knowledge:{domain}" etc. */
  id: string;
  /** Full URL path to the page or resource (relative to site root). */
  url: string;
  /** ISO 639-1 language code (e.g. "de", "uk"). */
  lang: string;
  /** Content type — determines metadata filtering. */
  type: SearchChunkType;
  /** Block ID within the page (null for knowledge/faq chunks). */
  blockId: string | null;
  /** Heading text extracted from the block (optional). */
  heading: string | null;
  /** Body text extracted from the block, truncated to SEARCH_CHUNK_TEXT_MAX_LENGTH. */
  text: string;
}

/** Static search manifest — build-time output written to public/api/agent/v1/search-manifest.json. */
export interface SearchManifest {
  schema: string;
  site: string;
  model: string;
  dimensions: number;
  /** sha256 hex over sorted-key JSON of this document minus contentHash + generatedAt. */
  contentHash: string;
  /** ISO timestamp — present in output but excluded from contentHash. */
  generatedAt: string;
  chunks: SearchChunk[];
}

// ---------------------------------------------------------------------------
// Query / response (runtime API contracts)
// ---------------------------------------------------------------------------

/** Query parameters for the search endpoint. */
export interface SearchQuery {
  /** Natural language search query (max 1000 chars). */
  q: string;
  /** Filter by language (optional). */
  lang?: string;
  /** Filter by content type (optional). */
  type?: SearchChunkType;
  /** Number of results to return (default 5, max 20). */
  topK?: number;
}

/** A single search result — chunk + similarity score. */
export interface SearchResult {
  chunk: SearchChunk;
  /** Cosine similarity score (0..1, higher = more similar). */
  score: number;
}

/** Response from the search endpoint. */
export interface SearchResponse {
  query: string;
  results: SearchResult[];
  /** Server-side processing time in milliseconds. */
  tookMs: number;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Pure: assemble + hash the search manifest. Deterministic — sorts chunks by id,
 * excludes generatedAt from the content hash. Two runs on unchanged input are
 * byte-identical (excluding the timestamp).
 */
export function buildSearchManifest(input: {
  site: string;
  model: string;
  dimensions: number;
  generatedAt: string;
  chunks: SearchChunk[];
}): SearchManifest {
  const sortedChunks = [...input.chunks].sort((a, b) => a.id.localeCompare(b.id));
  const base: Omit<SearchManifest, "contentHash"> = {
    schema: SEARCH_MANIFEST_SCHEMA_VERSION,
    site: input.site,
    model: input.model,
    dimensions: input.dimensions,
    generatedAt: input.generatedAt,
    chunks: sortedChunks,
  };
  const contentHash = computeSearchManifestContentHash(base);
  return { ...base, contentHash };
}

/** sha256 hex over the canonical JSON of the manifest minus contentHash + generatedAt + proof. */
export function computeSearchManifestContentHash(
  doc: Omit<SearchManifest, "contentHash"> | Record<string, unknown>,
): string {
  const {
    contentHash: _ch,
    generatedAt: _ga,
    proof: _proof,
    ...rest
  } = doc as Record<string, unknown>;
  return createHash("sha256").update(canonicalJson(rest), "utf8").digest("hex");
}
