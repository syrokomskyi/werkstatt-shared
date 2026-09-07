# `@warpgogol/werkstatt-shared` — Agent Guide

RFC-0868: Stack-agnostic shared infrastructure extracted from `@warpgogol/werkstatt-site`. Owns checks, integration, ontology, passport, share, and surface domains consumed by both the engine and site plugin.

**Workspace type:** Package

This is a **package** workspace. Expose stable typed APIs. Do not import from `werkstatt-site` or services.

## Boundary rules

- This package MUST NOT import from `@warpgogol/werkstatt-site` — enforced by `werkstatt.shared.validate`.
- This package MAY import from `@warpgogol/werkstatt-engine` (engine) and external packages.
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

Location: `packages/werkstatt-shared/src/share/slug/` — exported via `@warpgogol/werkstatt-shared/share/slug`.

| Export | Purpose |
| --- | --- |
| `slugUrl(text, lang?)` | Locale-aware URL slug (German umlauts, Ukrainian transliteration, default) |
| `slugId(text)` | Semantic block ID slug (replaces custom NFKD slugify) |
| `HeadingSlugger` | Stateful heading anchor deduplication (wraps github-slugger) |

Rules:

- Agents MUST import slug utilities from `@warpgogol/werkstatt-shared/share/slug` and MUST NOT reimplement slugify logic.
- The external packages `@sindresorhus/slugify`, `cyrillic-to-translit-js`, and `github-slugger` are dependencies of this package only — no other package may declare them as direct dependencies.
- Enforcement: `utility.provenance.validate` (RFC-0916) scans for reimplementations outside the canonical path.

### Semantic extraction (RFC-0901)

Location: `packages/werkstatt-shared/src/share/semantic/` — exported via `@warpgogol/werkstatt-shared/share/semantic`.

| Export | Purpose |
| --- | --- |
| `splitSentences(text, locale?)` | Locale-aware sentence boundary detection with abbreviation handling for `de`, `uk`, `en` (RFC-0901) |

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

### Utility registry (RFC-0916)

Location: `packages/werkstatt-shared/src/share/utility-registry.yaml`

To add a new canonical utility:

1. Implement the utility in `packages/werkstatt-shared/src/share/<name>/`
2. Add a subpath export to `packages/werkstatt-shared/package.json`
3. Add an entry to `utility-registry.yaml` with `id`, `canonicalPath`, `forbiddenImports`, `functionNames`, `patterns`, and `allowlist`
4. Document the utility in this AGENTS.md section

### Remediation catalog (RFC-1027)

Location: `packages/werkstatt-shared/src/share/remediation/remediation-catalog.ts` — exported via `@warpgogol/werkstatt-shared/share/remediation`.

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

Location: `packages/werkstatt-shared/src/share/agent/search.ts` — exported via `@warpgogol/werkstatt-shared/share/agent/search`.

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

Location: `packages/werkstatt-shared/src/share/routes/template-filter.ts` — exported via `@warpgogol/werkstatt-shared/share/routes/template-filter`.

| Export | Purpose |
| --- | --- |
| `hasPlaceholderRoutes(routes)` | Detect Astro dynamic route templates (e.g. `[slug]`, `[version]`) that are expanded by generators, not actual pages |

Rules:

- All `system.md` consumers MUST import placeholder detection from `@warpgogol/werkstatt-shared/share/routes/template-filter`.
- Enforcement: `utility.provenance.validate` (RFC-0916) scans for reimplementations outside the canonical path.

### Client-side dependency import guidance (RFC-0955)

When adding a third-party dependency to `packages/werkstatt-shared/package.json` `dependencies` that is imported by client-side scripts (`src/share/scripts/**/*.ts`) or client-side components (`packages/werkstatt-site/src/domain/ui/components/**/*.client.ts`):

1. Check if the package has a `browser` field in its `package.json` — if yes, no action needed.
2. If no `browser` field, use a deep import to the browser-compatible entry (e.g. `qrcode/lib/browser.js`).
3. If neither is possible, add the package to `optimizeDeps.include` in `astro.config.template.mjs`.
4. Run `vite.client-deps.validate` to verify.

Agents MUST NOT automatically replace imports based on validator output — the validator only reports potential issues. Remediation requires human analysis of the package's export structure.

### Scroll-spy URL hash updates (RFC-1061)

Location: `packages/werkstatt-shared/src/share/scripts/scroll-spy.ts` — exported via `@warpgogol/werkstatt-shared/share/scripts`.

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
