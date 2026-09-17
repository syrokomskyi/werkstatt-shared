# `@warpgogol/werkstatt-shared` — Agent Guide

RFC-0868: Stack-agnostic shared infrastructure extracted from `@warpgogol/werkstatt-site`. Owns checks, integration, ontology, passport, share, and surface domains consumed by both the engine and site plugin.

**Workspace type:** Package

This is a **package** workspace. Expose stable typed APIs. Do not import from `werkstatt-site` or services.

## Boundary rules

- This package MUST NOT import from `@warpgogol/werkstatt-site` — enforced by `werkstatt.shared.validate` (SHARED-03).
- This package MUST NOT import from `@warpgogol/werkstatt-engine` — enforced by `werkstatt.shared.validate` (SHARED-04, RFC-1104). This package is a leaf: the engine depends on it, never the reverse.
- This package MAY import external packages declared in its own `package.json`.

## Canonical homes (RFC-1104)

The kernel contract cluster and platform-operations schemas are owned here, not in the engine:

| Home | Contents | Subpath |
| --- | --- | --- |
| `src/kernel/` | Kernel command/pipeline types, `WorkspaceIO`, `writeFileAtomic`, `DesiredState`, diagnostic schemas | `@warpgogol/werkstatt-shared/kernel` |
| `src/component/` | Component contract types (`ComponentId`, `CapabilityId`, `EffectClass`, `IsolationTier`, `ComponentDeclaration`, `SCOPE_ERROR_CODES`) | `@warpgogol/werkstatt-shared/component` |
| `src/signing/` | Ed25519 signing core (`generateKeyPair`, `signBytes`, `verifyBytes`, `canonicalBytes`) | `@warpgogol/werkstatt-shared/signing` |
| `src/fingerprint/` | Hashing primitives (`byteHash`, `stableStringify`, `isSha256Digest`) and canonical JSON v1 | `@warpgogol/werkstatt-shared/fingerprint` |
| `src/ontology/operations/` | Platform-ops schemas (handoff, sternsystem, werkstatt, mission, release, leitstand, notausgang, materialization, artifact-store, naming-policy, dht) | `@warpgogol/werkstatt-shared/ontology/operations` |

Rules:

- `src/kernel/` and `src/signing/` import Node-only APIs (`node:fs`, `node:child_process`, `@noble/ed25519`) — they MUST NOT be re-exported from browser-reachable barrels (`src/index.ts` or any module imported by client-side code). Consumers use the dedicated subpaths above.
- The engine preserves its old package specifiers via forwarding modules and retargeted barrels — consumers of `@warpgogol/werkstatt-engine/kernel`, `/schemas`, `/signing`, `/fingerprint`, `/component` keep working, but new code SHOULD import from the `@warpgogol/werkstatt-shared/*` canonical homes.
- Axiom dependencies (`@syrokomskyi/axiom-*`) are `optionalDependencies` — consumers without axiom installed must use type-only imports or guard runtime access.

## Scripts

| Script        | Command                                   |
| ------------- | ----------------------------------------- |
| `lint`        | `pnpm exec eslint "src/**/*.ts"`          |
| `typecheck`   | `pnpm exec tsc -p tsconfig.json --noEmit` |
| `build`       | `pnpm exec tsc -p tsconfig.json --noEmit` |
| `build:check` | `pnpm exec tsc -p tsconfig.json --noEmit` |
| `test`        | `vitest run`                              |
| `test:watch`  | `vitest`                                  |

## NPM publishing

- Package is published as `@warpgogol/werkstatt-shared` with `access: public`.
- `prepublishOnly` runs typecheck before publish.
- Publication is operator-triggered via repo-extract (RFC-0773). See `extract.config.yaml` and `docs/authoring/publication-runbook.md`.

## Canonical utilities

### Slug generation (RFC-0915, DNA-88)

Location: `packages/werkstatt-shared/src/share/slug/` — exported via `@warpgogol/werkstatt-shared/slug`.

| Export | Purpose |
| --- | --- |
| `slugUrl(text, lang?)` | Locale-aware URL slug (German umlauts, Ukrainian transliteration, default) |
| `slugId(text)` | Semantic block ID slug (replaces custom NFKD slugify) |
| `HeadingSlugger` | Stateful heading anchor deduplication (wraps github-slugger) |

Rules:

- Agents MUST import slug utilities from `@warpgogol/werkstatt-shared/slug` and MUST NOT reimplement slugify logic.
- The external packages `@sindresorhus/slugify`, `cyrillic-to-translit-js`, and `github-slugger` are dependencies of this package only — no other package may declare them as direct dependencies.
- Enforcement: `utility.provenance.validate` (RFC-0916) scans for reimplementations outside the canonical path.

### Semantic extraction (RFC-0901)

Location: `packages/werkstatt-shared/src/share/semantic/` — exported via `@warpgogol/werkstatt-shared/semantic`.

| Export | Purpose |
| --- | --- |
| `splitSentences(text, locale?)` | Locale-aware sentence boundary detection with abbreviation handling for `de`, `uk`, `en` (RFC-0901) |
| `projectClaims(claims, evidenceSources)` | Project PBP claims with evidence provenance into `SemanticClaimProvenance[]` (RFC-1076) |
| `SemanticClaimProvenance` | Claim provenance type: id, claimClass, claimKind, statement, evidence refs |
| `SemanticEvidenceRef` | Evidence reference type: id, kind, label, sha256, canonicalUri |
| `formatClaims(site)` | Format claims section for `llms-full.txt` (RFC-1076) |

### Claim provenance projection (RFC-1076)

Location: `packages/werkstatt-shared/src/share/semantic/business-projection.ts` — exported via `@warpgogol/werkstatt-shared/semantic`.

`projectClaims(claims, evidenceSources)` filters published claims, resolves evidence references via the `ref` field on `PbpEntityRef`, and projects canonical item hashes. Only claims with `status: "published"` and a non-empty `id` are included. Evidence sources are keyed by their `id` field.

`formatClaims(site)` in `llms.ts` renders a `## Claims` section in `llms-full.txt` when `site.claims` is non-empty — omitted entirely when no claims exist.

### Canonical entity URL policy (RFC-0910)

Entity identity URLs in JSON-LD (`Organization.url`, `WebSite.url`, `BreadcrumbList` home item, same-origin `Person.url`) MUST be canonical — the unprefixed root URL (`https://site/`), never language-prefixed (`https://site/de/`).

| Export                      | Purpose                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `canonicalRootUrl(baseUrl)` | Produce the unprefixed root URL for entity identity (RFC-0910) |

Rules:

- `buildOrganizationProfile` uses `canonicalRootUrl(baseUrl)` for `Organization.url`.
- `WebSite.url` inherits from `page.organization.url` — no separate fix needed.
- Breadcrumb home item uses `localizeUrl(lang, "", { defaultLanguage })` which produces `/` for the default language (RFC-0160) — already correct.
- Same-origin `Person.url` must not carry the default-language prefix (e.g. `/de/team/jane` is a violation; `/team/jane` is correct).
- External `Person.url` (different origin) is not canonicalized — only same-origin profile URLs are checked.
- Enforcement: `jsonld.canonical-entity.validate` (RFC-0910) in `@warpgogol/werkstatt-site` scans rendered HTML and emits JSONLD-ENTITY-01..03.

### Canonical URI derivation (RFC-1075)

Location: `packages/werkstatt-shared/src/share/semantic/canonical-uri.ts` — exported via `@warpgogol/werkstatt-shared/semantic/canonical-uri`.

| Export | Purpose |
| --- | --- |
| `deriveCanonicalUri(siteOrigin, entityType, entityId?)` | Derive a persistent canonical URI for Linked Data `@id` from site origin and entity identity |

Format: `{siteOrigin}/.well-known/entity/{entityType}/{entityId}`

Rules:

- The URI is an identifier, not necessarily a dereferenceable resource. No resolver endpoint is implemented.
- For `business` entities, `entityId` is omitted: `{origin}/.well-known/entity/business`.
- For `offering` entities, `entityId` is the offering ID: `{origin}/.well-known/entity/offering/{id}`.
- Trailing slashes on `siteOrigin` are stripped before derivation.
- If `siteOrigin` is absent or empty, `deriveCanonicalUri` returns `undefined` and no `@id` is emitted.
- An explicitly authored `canonicalUri` on a `PbpEntity` takes priority over derivation.
- The function is pure, side-effect-free, and deterministic.

### Canonical fact extraction (RFC-1077)

Location: `packages/werkstatt-shared/src/share/semantic/fact-extraction.ts` — exported via `@warpgogol/werkstatt-shared/semantic/fact-extraction`.

| Export | Purpose |
| --- | --- |
| `CanonicalFact` | Interface for a canonical fact: type, entityId, entityType, value, surface, source |
| `normalizeFactValue(type, value)` | Normalize a fact value for cross-surface comparison (email→lowercase, phone→strip tel: and separators, price→strip currency suffix + German thousands separator + parse as float, others→trim) |

Rules:

- This module is package-boundary-safe: it defines the contract and normalization only. Fact extraction from PBP and rendered surfaces lives in `@warpgogol/werkstatt-site`.
- The `CanonicalFact` interface is the shared contract between the canonical source (PBP resolved graph) and surface extractors (HTML, JSON-LD, llms-full.txt).
- `normalizeFactValue` is pure and deterministic.

### SystemManifest `seo` field (RFC-0911)

The `SystemManifest` interface in `packages/werkstatt-shared/src/content/system-manifest.ts` includes an optional `seo` field for SEO validator configuration:

```ts
seo?: {
  anchorText?: {
    extraStopPhrases?: Record<string, string[]>; // lang -> phrases
  };
};
```

- Sites extend the built-in de/uk anchor-text stop-list by declaring `seo.anchorText.extraStopPhrases` in `system.md` frontmatter.
- The field is optional; validators fall back to built-in defaults when absent.

### SystemManifest `typography` field (RFC-1070)

The `SystemManifest` interface in `packages/werkstatt-shared/src/content/system-manifest.ts` includes an optional `typography` field for typography validator configuration:

```ts
typography?: {
  abbreviations?: Record<string, string[]>;
  allowedTokens?: string[];
};
```

- Sites extend the built-in locale abbreviation defaults by declaring `typography.abbreviations` in `system.md` frontmatter. Overrides are merged (not replacement) with built-in defaults.
- Sites add exempt tokens (e.g. brand names with mixed case) via `typography.allowedTokens`. These extend `DEFAULT_ALLOWED_TOKENS`.
- The Zod schema is `systemTypographySchema` in `packages/werkstatt-shared/src/ontology/schemas/system/text.ts`, referenced as a top-level field in `systemManifestSchema`.
- The field is optional; validators fall back to built-in defaults when absent.

### SystemManifest `ui` field (RFC-1087)

The `SystemManifest` interface in `packages/werkstatt-shared/src/ontology/schemas/system/manifest.ts` includes an optional `ui` object with a `codeHighlightTheme` field:

```ts
ui?: {
  codeHighlightTheme?: string;
};
```

- Sites declare a Shiki theme name (e.g. `github-dark`, `one-dark-pro`) for build-time code highlighting.
- The theme is threaded through `highlightCodeBlocks` and `ProsePipelineOptions` in `@warpgogol/werkstatt-site`.
- When absent, the default `github-light` theme is used.
- The field is optional; consumers fall back to the default theme when absent.

### Typography rule tiers (RFC-1068, RFC-1069, RFC-1070, RFC-1071)

Location: `packages/werkstatt-shared/src/share/typography/` — exported via `@warpgogol/werkstatt-shared/typography`.

| Export | Purpose |
| --- | --- |
| `TIER1_RULES` | 15 Tier 1 rules: PUNCT (4), SPACE (4), CASE (2), LOCALE (3), YAML (2) — RFC-1068 |
| `TIER2_STRUCTURE_RULES` | 9 Tier 2 structure rules: HEAD (3), PAIR (3), MD (3) — RFC-1069 |
| `TIER2_LOCALE_RULES` | 7 Tier 2 locale rules: NUM (3), ABBR (2), APOS (2) — RFC-1070 |
| `TIER3_ADVISORY_RULES` | 5 Tier 3 advisory rules: UNICODE (2), LINK (2), SENT (1) — RFC-1071 |
| `FixAction` | Discriminated union type for mechanical fix actions (`replace`, `insert`, `delete`) — RFC-1072 |
| `FIXABLE_RULE_IDS` | Whitelist of 7 rule IDs safe for mechanical fixing — RFC-1072 |
| `isFixable(ruleId)` | Check if a rule ID is in the fixable whitelist — RFC-1072 |
| `applyFixes(findings, ctx)` | Apply mechanical fixes to findings, returning fixed segment text — RFC-1072 |

Tier 3 advisory rules (RFC-1071):

- `TYPO-UNICODE-01` — zero-width characters (U+200B, U+200C, U+200D, U+FEFF)
- `TYPO-UNICODE-02` — soft hyphen (U+00AD)
- `TYPO-LINK-01` — bare URL as link text (e.g. `[https://example.com](https://example.com)`)
- `TYPO-LINK-02` — generic link text (click here, hier klicken, тут, here, hier)
- `TYPO-SENT-01` — sentence longer than 40 words

All Tier 3 rules have `severity: "warning"` and `tier: 3`. They never cause `typography.validate` to exit non-zero. The `--mode error` flag does not upgrade Tier 3 findings to error severity.

Typography rule implementation notes (RFC-1083):

- `isBodyHeading` checks per-line (not whole body): a segment is a heading only if it is a single line matching `^#{1,6}\s+.+$`. Multi-line body fields starting with `##` are NOT headings — they are body content.
- PUNCT-04 excludes `\d+\.x` version patterns: the DOT_LETTER branch checks the character before the dot (must be a digit) and the letter after the dot (must be `x` followed by a non-word character or end of string). This prevents false positives on version strings like "4.x" or "2.0.x".

### Utility registry (RFC-0916)

Location: `packages/werkstatt-shared/src/share/utility-registry.yaml`

To add a new canonical utility:

1. Implement the utility in `packages/werkstatt-shared/src/share/<name>/`
2. Add a subpath export to `packages/werkstatt-shared/package.json`
3. Add an entry to `utility-registry.yaml` with `id`, `canonicalPath`, `forbiddenImports`, `functionNames`, `patterns`, and `allowlist`
4. Document the utility in this AGENTS.md section

### Remediation catalog (RFC-1027)

Location: `packages/werkstatt-shared/src/share/remediation/remediation-catalog.ts` — exported via `@warpgogol/werkstatt-shared/remediation`.

| Export | Purpose |
| --- | --- |
| `REMEDIATION_CATALOG` | Map of ruleId to remediation pattern (action, template, docRef, targetFiles) |
| `lookupRemediation(ruleId)` | Lookup helper returning the pattern or undefined |
| `RemediationPattern` | Type for catalog entries |

Rules:

- `diagnosticsResult()` auto-populates `Diagnostic.remediation` from this catalog when the diagnostic has no explicit remediation field.
- `remediation.hint.validate` (engine command) cross-references catalog entries with validator `rules[]` declarations — REMEDIATION-01 for missing entries, REMEDIATION-02 for stale ones.
- `remediation.catalog.generate` (engine command) emits `docs/remediation-catalog.generated.yaml` from the catalog.
- To add a new remediation pattern, add an entry to `REMEDIATION_ENTRIES` in `remediation-catalog.ts` and run `remediation.catalog.generate`.

### Agent Surface search (RFC-0954)

Location: `packages/werkstatt-shared/src/share/agent/search.ts` — exported via `@warpgogol/werkstatt-shared/agent/search`.

| Export | Purpose |
| --- | --- |
| `SearchManifest` | Schema for the build-time search manifest (chunks, pages, schema version) |
| `SearchChunk` | Schema for a single search chunk (id, text, url, lang, type, heading) |
| `SearchQuery` | Schema for inbound search queries (query, topK, lang) |
| `SearchResponse` | Schema for search responses (results, query, took) |
| `SearchResult` | Schema for a single search result (chunk, score) |
| `SEARCH_EMBEDDING_MODEL` | Pinned Workers AI embedding model (`@cf/baai/bge-m3`) |
| `SEARCH_EMBEDDING_DIMENSIONS` | Vector dimensions for the pinned model (1024) |
| `SEARCH_MAX_TOP_K` | Maximum results per query (20) |
| `SEARCH_DEFAULT_TOP_K` | Default results per query (5) |
| `SEARCH_CHUNK_TEXT_MAX_LENGTH` | Maximum chunk text length before truncation (2000) |
| `SEARCH_MANIFEST_SCHEMA_VERSION` | Search manifest schema version ("1") |
| `SEARCH_MANIFEST_PATH` | Static asset path for the generated search manifest |
| `NON_KNOWLEDGE_FILES` | Files in the knowledge directory that are not knowledge envelopes (exclusion list) |
| `isNonKnowledgeFile(filename)` | Returns true if the filename is a non-knowledge file (e.g. `search-manifest.json`) |

### Placeholder route filtering (RFC-0917)

Location: `packages/werkstatt-shared/src/share/routes/template-filter.ts` — exported via `@warpgogol/werkstatt-shared/routes/template-filter`.

| Export | Purpose |
| --- | --- |
| `hasPlaceholderRoutes(routes)` | Detect Astro dynamic route templates (e.g. `[slug]`, `[version]`) that are expanded by generators, not actual pages |

Rules:

- All `system.md` consumers MUST import placeholder detection from `@warpgogol/werkstatt-shared/routes/template-filter`.
- Enforcement: `utility.provenance.validate` (RFC-0916) scans for reimplementations outside the canonical path.

### Client-side dependency import guidance (RFC-0955)

When adding a third-party dependency to `packages/werkstatt-shared/package.json` `dependencies` that is imported by client-side scripts (`src/share/scripts/**/*.ts`) or client-side components (`packages/werkstatt-site/src/domain/ui/components/**/*.client.ts`):

1. Check if the package has a `browser` field in its `package.json` — if yes, no action needed.
2. If no `browser` field, use a deep import to the browser-compatible entry (e.g. `qrcode/lib/browser.js`).
3. If neither is possible, add the package to `optimizeDeps.include` in `astro.config.template.mjs`.
4. Run `vite.client-deps.validate` to verify.

Agents MUST NOT automatically replace imports based on validator output — the validator only reports potential issues. Remediation requires human analysis of the package's export structure.

### Scroll-spy URL hash updates (RFC-1061)

Location: `packages/werkstatt-shared/src/share/scripts/scroll-spy.ts` — exported via `@warpgogol/werkstatt-shared/client-scripts`.

| Export | Purpose |
| --- | --- |
| `initScrollSpy(options?)` | Initialize IntersectionObserver-based scroll-spy; returns cleanup callback |
| `ScrollSpyOptions` | Optional configuration (selector, rootMargin, threshold, clearAtTop) |

Rules:

- Always-on — no opt-in flag in `OrchestrationOptions`. The orchestrator calls `initScrollSpy()` unconditionally as step 12.
- Uses `history.replaceState` (not `pushState`) to avoid polluting browser history.
- Excludes sections inside `.wl-modal` elements.
- Graceful degradation: returns no-op cleanup if `IntersectionObserver` is unsupported or no `section[id]` elements exist.
- Idempotent: calling twice disconnects the previous observer before creating a new one.

## Test coverage

RFC-1044 (Phase 2) ratcheted the package adjacency ratio from 29% to 62% by adding 70 adjacent test files across Groups A (share/schemas + ontology/schemas) and B (share/scripts + share/agent + share/knowledge). Groups C-E remain for follow-up sessions. The adjacency baseline is tracked via `.test-adjacency-baseline.json` and enforced by `test.adjacency.validate` (RFC-1040).

## Testing conventions

- **Zod schema tests**: Always inspect the schema definition before writing test data. Test data must match exact field names, required fields, enum values, and optional/nullable constraints. Mismatched test data is the most common cause of test failures in this package.
- **Type inference in tests**: Prefer `z.infer<typeof schema>` over `as Type` casts for typed test data. This ensures type safety and catches schema drift when schemas evolve.
- **Client-side script tests**: Tests for functions that access `document` or `window` require DOM mocking via `vi.stubGlobal` in vitest. Stub `document` and `window` in `beforeEach` and restore with `vi.unstubAllGlobals()` in `afterEach`.
- **IntersectionObserver mock**: Use a `class` with a constructor that pushes the callback and returns an instance object — `vi.fn().mockImplementation()` is NOT a constructor and `new IntersectionObserver()` throws "is not a constructor". Also stub `IntersectionObserver` on both `window` and as a global, since the code checks `"IntersectionObserver" in window`.
- **Element stub for orchestrator tests**: The orchestrator's `has()` helper uses `document.querySelector(selector) instanceof Element`. In Node environment, `Element` is undefined — stub it in `beforeEach` via `vi.stubGlobal("Element", class MockElement {})`.
- **RFC evidence path format**: `rfc.validate` parses evidence paths literally — do NOT wrap paths in backticks. Use `(evidence: test: packages/path/to/file.test.ts)`, not `(evidence: test: \`packages/path/to/file.test.ts\`)`. Backticks cause "references a file that does not exist" errors.
