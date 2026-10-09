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

- `src/kernel/` and `src/signing/` import Node-only APIs (`node:fs`, `node:child_process`, `@noble/ed25519`) — they MUST NOT be re-exported from browser-reachable barrels (any module imported by client-side code). Consumers use the dedicated subpaths above. The package has no root `.` export (RFC-1106) — all consumption is via subpaths.
- The engine preserves its old package specifiers via forwarding modules and retargeted barrels — consumers of `@warpgogol/werkstatt-engine/kernel`, `/schemas`, `/signing`, `/fingerprint`, `/component` keep working, but new code SHOULD import from the `@warpgogol/werkstatt-shared/*` canonical homes.
- Axiom dependencies (`@syrokomskyi/axiom-*`) are `optionalDependencies` — consumers without axiom installed must use type-only imports or guard runtime access.
- **`createReadOnlyIO` tmpdir carve-out must exclude `opts.workspaceRoot` (RFC-1176).** Mutations under `os.tmpdir()` pass through as scratch, but a workshop may itself live under `$TMPDIR` (test fixtures, CI smoke workspaces) — without the exclusion the read-only adapter silently permits every workspace mutation. The executor passes `context.workspaceRoot`; keep the exclusion check ahead of the tmpdir prefix match. Wrapped adapters report `io.readonly === true` — commands use it to skip best-effort writes instead of relying on KERNEL-META-01 throws.
- **Lifecycle/status sets consumed by BOTH emission and validation live here, not in the emitter.** When a generator emits routes/artifacts for a subset of statuses and a validator must apply the same filter (parity, topology, coverage), define the shared predicate/constants in `werkstatt-shared` (e.g. `REFERRAL_ROUTE_EMITTING_STATUSES` in `src/referral/partners.ts`) and consume it from both sides. Duplicating the set in `werkstatt-site` checks and codegen makes the two sources of truth diverge silently — a validator demanding an artifact for a status the emitter never produces. Discovered during RFC-1244 review r1 (paused partners demanded a `.json` twin the emitter intentionally skips).

## Domain layout (RFC-1105)

The `src/share/` namespace is dissolved. Every former `share/` subdomain is now a top-level `src/` directory with a matching subpath export:

| Domain | Subpath | Notes |
| --- | --- | --- |
| `agent`, `content-discipline`, `i18n`, `knowledge`, `legal`, `middleware`, `pbt`, `remediation`, `routes`, `schemas`, `semantic`, `slug`, `typography`, `types` | `@warpgogol/werkstatt-shared/<name>` | Mechanical promotion |
| `content` | `@warpgogol/werkstatt-shared/content` | `share/content/*` merged into the existing dir |
| `onboarding` | `@warpgogol/werkstatt-shared/onboarding` | `share/onboarding-yaml` merged as `onboarding/yaml.ts` |
| `client-scripts` | `@warpgogol/werkstatt-shared/client-scripts` | Browser-only (gsap, lenis, plyr, hls, lordicon, counter-utils) |
| `node` | `@warpgogol/werkstatt-shared/node/*` | Node-only (`node/fs`, `node/import-scan`, `node/dev-props-validator`, `node/semantic/*`) |
| `text`, `policy`, `page`, `redirects`, `image-provider`, `attribution`, `offers`, `checks`, `runtime`, `sections`, `stack` | `@warpgogol/werkstatt-shared/<name>` | Former loose files grouped by domain |

Classification rule for new modules:

- **Node-only** (`node:*` imports, `createRequire`, subprocess) → `src/node/` with domain-preserving structure (`node/<domain>/…`).
- **Browser-only** (DOM, `window`, client script init) → `src/client-scripts/`.
- **Everything else** → runtime-agnostic domain dir; pick the domain whose name matches the module's responsibility, or create a new top-level domain dir — never a catch-all.

Rules:

- `src/node/` modules MUST NOT be re-exported from runtime-agnostic domain barrels (`src/<domain>/index.ts`) — the browser/Node seam is a filesystem fact, keep it that way.
- `utility-registry.yaml` lives at the package root (not under `src/`).
- Tests live in `<domain>/tests/` next to their domain.

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

Location: `packages/werkstatt-shared/src/slug/` — exported via `@warpgogol/werkstatt-shared/slug`.

| Export | Purpose |
| --- | --- |
| `slugUrl(text, lang?)` | Locale-aware URL slug (German umlauts, Ukrainian transliteration, default) |
| `slugId(text)` | Semantic block ID slug (replaces custom NFKD slugify) |
| `HeadingSlugger` | Stateful heading anchor deduplication (wraps github-slugger) |

Rules:

- Agents MUST import slug utilities from `@warpgogol/werkstatt-shared/slug` and MUST NOT reimplement slugify logic.
- The external packages `@sindresorhus/slugify`, `cyrillic-to-translit-js`, and `github-slugger` are dependencies of this package only — no other package may declare them as direct dependencies.
- Enforcement: `utility.provenance.validate` (RFC-0916) scans for reimplementations outside the canonical path.

### Section heading-id derivation (RFC-1196)

Location: `packages/werkstatt-shared/src/sections/heading-id.ts` — exported via `@warpgogol/werkstatt-shared/sections/heading-id`.

| Export | Purpose |
| --- | --- |
| `sectionHeadingId(typeId, sectionNumber, sectionId)` | Single resolver for section heading ids — `sectionNumber \|\| sectionId` falsy fallback, bare `typeId` when no prefix source exists |

Rules:

- Agents MUST import `sectionHeadingId` for any heading-id or `aria-labelledby` derivation and MUST NOT inline prefix expressions — `section-header` and `section-shell` consume it so the pair can never diverge.
- The `sectionNumber` fallback is falsy (`||`), never `??` — `""` must behave like absent (leading-dash ids are invalid and non-unique).

### Semantic extraction (RFC-0901)

Location: `packages/werkstatt-shared/src/semantic/` — exported via `@warpgogol/werkstatt-shared/semantic`.

| Export | Purpose |
| --- | --- |
| `splitSentences(text, locale?)` | Locale-aware sentence boundary detection with abbreviation handling for `de`, `uk`, `en` (RFC-0901) |
| `projectClaims(claims, evidenceSources)` | Project PBP claims with evidence provenance into `SemanticClaimProvenance[]` (RFC-1076) |
| `SemanticClaimProvenance` | Claim provenance type: id, claimClass, claimKind, statement, evidence refs |
| `SemanticEvidenceRef` | Evidence reference type: id, kind, label, sha256, canonicalUri |
| `formatClaims(site)` | Format claims section for `llms-full.txt` (RFC-1076) |

### Claim provenance projection (RFC-1076)

Location: `packages/werkstatt-shared/src/semantic/business-projection.ts` — exported via `@warpgogol/werkstatt-shared/semantic`.

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

Location: `packages/werkstatt-shared/src/semantic/canonical-uri.ts` — exported via `@warpgogol/werkstatt-shared/semantic/canonical-uri`.

| Export | Purpose |
| --- | --- |
| `deriveCanonicalUri(siteOrigin, entityType, entityId?)` | Derive a persistent canonical URI for Linked Data `@id` from site origin and entity identity |

Format (RFC-1115): `{siteOrigin}/.well-known/entity/{entityType}/{entityId}.json`

Rules:

- The URI is dereferenceable — `agent.knowledge.generate` emits a static JSON-LD document at each path under `public/.well-known/entity/`, served as `application/ld+json` via the `_headers` rule.
- For `business` entities, `entityId` is omitted: `{origin}/.well-known/entity/business.json`.
- For `offering` entities, `entityId` is the offering ID: `{origin}/.well-known/entity/offering/{id}.json`.
- Trailing slashes on `siteOrigin` are stripped before derivation.
- If `siteOrigin` is absent or empty, `deriveCanonicalUri` returns `undefined` and no `@id` is emitted.
- An explicitly authored `canonicalUri` on a `PbpEntity` takes priority over derivation.
- The function is pure, side-effect-free, and deterministic.

### Canonical fact extraction (RFC-1077)

Location: `packages/werkstatt-shared/src/semantic/fact-extraction.ts` — exported via `@warpgogol/werkstatt-shared/semantic/fact-extraction`.

| Export | Purpose |
| --- | --- |
| `CanonicalFact` | Interface for a canonical fact: type, entityId, entityType, value, surface, source |
| `normalizeFactValue(type, value)` | Normalize a fact value for cross-surface comparison (email→lowercase, phone→strip tel: and separators, price→strip currency suffix + German thousands separator + parse as float, others→trim) |

Rules:

- This module is package-boundary-safe: it defines the contract and normalization only. Fact extraction from PBP and rendered surfaces lives in `@warpgogol/werkstatt-site`.
- The `CanonicalFact` interface is the shared contract between the canonical source (PBP resolved graph) and surface extractors (HTML, JSON-LD, llms-full.txt).
- `normalizeFactValue` is pure and deterministic.

### SystemManifest `seo` field (RFC-0911)

The `SystemManifest` type (derived from `systemManifestSchema` in `packages/werkstatt-shared/src/ontology/schemas/system/manifest.ts`) includes an optional `seo` field for SEO validator configuration:

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

The `SystemManifest` type (derived from `systemManifestSchema` in `packages/werkstatt-shared/src/ontology/schemas/system/manifest.ts`) includes an optional `typography` field for typography validator configuration:

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

The `SystemManifest` type (derived from `systemManifestSchema` in `packages/werkstatt-shared/src/ontology/schemas/system/manifest.ts`) includes an optional `ui` object with a `codeHighlightTheme` field:

```ts
ui?: {
  codeHighlightTheme?: string;
};
```

- Sites declare a Shiki theme name (e.g. `github-dark`, `one-dark-pro`) for build-time code highlighting.
- The theme is threaded through `highlightCodeBlocks` and `ProsePipelineOptions` in `@warpgogol/werkstatt-site`.
- When absent, the default `github-light` theme is used.
- The field is optional; consumers fall back to the default theme when absent.

### SystemManifest `resourceBudget` field (RFC-1209)

The `SystemManifest` type includes an optional `resourceBudget` field for per-site resource-budget ceilings:

```ts
resourceBudget?: {
  maxPageWeightKb: number;
  maxJsKb: number;
  maxRequests: number;
  maxThirdPartyOrigins: number;
  enforce: "advisory" | "blocking";
  routeOverrides?: Record<string, Partial<…>>;
};
```

- Sites declare budgets in `system.md` frontmatter; when absent the workspace baseline `RESOURCE_BUDGET_BASELINE` applies (advisory by default — `enforce: "blocking"` is per-site opt-in only).
- The Zod schema is `resourceBudgetConfigSchema` in `src/policy/resource-budget.ts`, exported via `@warpgogol/werkstatt-shared/policy/resource-budget` alongside `resourceBudgetReportSchema`, `resolveResourceBudget`, and `effectiveBudgetForRoute`.
- `resource.budget.validate` / `resource.budget.report` (werkstatt-site checks) consume it; the emitted `/.well-known/resource-budget.json` is wall-clock-free (`buildContentHash`, DNA-58).

### SystemManifest strict parse (RFC-1106)

`loadSystemManifest` / `loadSystemManifestSync` in `src/content/system-manifest.ts` run `systemManifestSchema.parse()` — there is no interface and no `as unknown as` cast. The Zod schema in `src/ontology/schemas/system/manifest.ts` is the sole contract.

- Test fixtures writing `system.md` MUST be complete manifests: `app` (kebab-case), `version` (semver), `identity.systemStar`, `identity.biome` are required; `i18n` (when present) needs `default` + `supported` record (not a `languages` array); `pages[]` entries need `pageId` + `cosmicStar`; URL fields like `release.passport.heartbeatUrl` must be valid URLs (empty string fails).
- Do not re-add a hand-written `interface SystemManifest` — extend the schema instead.

### Typography rule tiers (RFC-1068, RFC-1069, RFC-1070, RFC-1071)

Location: `packages/werkstatt-shared/src/typography/` — exported via `@warpgogol/werkstatt-shared/typography`.

| Export | Purpose |
| --- | --- |
| `TIER1_RULES` | 15 Tier 1 rules: PUNCT (4), SPACE (4), CASE (2), LOCALE (3), YAML (2) — RFC-1068 |
| `TIER2_STRUCTURE_RULES` | 10 Tier 2 structure rules: HEAD (4), PAIR (3), MD (3) — RFC-1069 |
| `TIER2_LOCALE_RULES` | 7 Tier 2 locale rules: NUM (3), ABBR (2), APOS (2) — RFC-1070 |
| `TIER3_ADVISORY_RULES` | 5 Tier 3 advisory rules: UNICODE (2), LINK (2), SENT (1) — RFC-1071 |
| `FixAction` | Discriminated union type for mechanical fix actions (`replace`, `insert`, `delete`) — RFC-1072 |
| `FIXABLE_RULE_IDS` | Whitelist of 8 rule IDs safe for mechanical fixing — RFC-1072 |
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
- HEAD sentence gating (warpgogol-m000193): `TYPO-HEAD-01`/`03` fire only on single-sentence headings (title fragments must not end with `.`, `!`, `?`). `TYPO-HEAD-04` fires on multi-sentence headings (`splitSentences` ≥ 2) that lack a terminal `.`/`!`/`?` — prose in heading position must be fully terminated. HEAD-04 is autofixable (`typography.fix` inserts `.`).
- PUNCT-04 excludes `\d+\.x` version patterns: the DOT_LETTER branch checks the character before the dot (must be a digit) and the letter after the dot (must be `x` followed by a non-word character or end of string). This prevents false positives on version strings like "4.x" or "2.0.x".

### Utility registry (RFC-0916)

Location: `packages/werkstatt-shared/utility-registry.yaml`

To add a new canonical utility:

1. Implement the utility in `packages/werkstatt-shared/src/<name>/`
2. Add a subpath export to `packages/werkstatt-shared/package.json`
3. Add an entry to `utility-registry.yaml` with `id`, `canonicalPath`, `forbiddenImports`, `functionNames`, `patterns`, and `allowlist`
4. Document the utility in this AGENTS.md section

### Remediation catalog (RFC-1027)

Location: `packages/werkstatt-shared/src/remediation/remediation-catalog.ts` — exported via `@warpgogol/werkstatt-shared/remediation`.

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

Location: `packages/werkstatt-shared/src/agent/search.ts` — exported via `@warpgogol/werkstatt-shared/agent/search`.

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

### Agent Surface ARD catalog + Agent Skills documents (RFC-1090, RFC-1113)

Location: `packages/werkstatt-shared/src/agent/ard-catalog.ts` (catalog projection) and `src/agent/skill-md.ts` (SKILL.md builder) — exported via `@warpgogol/werkstatt-shared/agent/ard-catalog` and `.../agent/skill-md`. Generators: `agent.ard-catalog.generate`, `agent.discovery-endpoints.generate` (werkstatt-site).

| Export | Purpose |
| --- | --- |
| `ArdCatalog` | Schema for the ARD v0.91 catalog (`specVersion`, `generatedFrom`, `entries`) |
| `buildArdCatalog(manifest)` | Build the catalog projection — absolute entry URLs, whitelisted media types only |
| `assertArdCatalogManifestBijection(manifest, catalog)` | ARD-02/03 bijection check (A2A card, MCP card, knowledge domains) |
| `ARD_BASE_CONTEXT` | `@context` URI carried by every catalog entry |
| `MEDIA_AI_CATALOG` | `application/ai-catalog+json` — content type for both catalog paths |
| `MEDIA_A2A_AGENT_CARD` | `application/a2a-agent-card+json` — whitelisted A2A type |
| `MEDIA_MCP_SERVER_CARD` | `application/mcp-server-card+json` — whitelisted MCP type |
| `MEDIA_AGENT_SKILLS_MARKDOWN` | `text/markdown; profile="urn:air:agent-skills"` — knowledge-domain type |
| `buildKnowledgeSkillMarkdown(input)` | agentskills-conformant `SKILL.md` body for a knowledge domain (YAML-safe frontmatter) |

Conventions:

- Catalog is emitted identically to `/.well-known/ard.json` (canonical) and `/.well-known/ai-catalog.json` (legacy alias); entries advertise only whitelisted ARD media types — OpenAPI/search/manifest stay discoverable via api-catalog linkset, Link headers, and `auth.md`.
- Every catalog `url` is absolute (`toAbsoluteUrl(manifest.baseUrl, path)`); entries are sorted by `identifier` (DNA-58).
- Each knowledge domain gets a generated `/.well-known/agent-skills/<domain>/SKILL.md`; the catalog entry points at it. `agent.discovery-endpoints.generate` sweeps stale skill dirs and hashes the exact SKILL.md bytes into `agent-skills/index.json` digests (SHA-256).

### Schemamap surface contracts (RFC-1164)

This package owns the shared Schemamap contracts; the kernel commands (`jsonld.mirror.generate`, `jsonld.schemamap.validate`) and pure mirror helpers (`share/astro/jsonld-mirror.ts`) live in `packages/werkstatt-site`.

| Surface | Location | Contract |
| --- | --- | --- |
| RobotsPolicy | `src/semantic/robots.ts` | `RobotsPolicy` has no `schemamap` field (RFC-1175: the `Schemamap:` robots directive was retired — Lighthouse flags it as unknown). Discovery is the head `<link rel="schemamap">` + `interfaces.schemamap`; `ROBOTS_DIRECTIVE_ALLOWLIST` bounds the directive names `robots.validate` accepts (ROBOTS-SURFACE-01, warning) |
| Agent manifest | `src/agent/manifest.ts` | `"schemamap"` in `AgentProtocol`; `AgentSurfaceManifest.interfaces.schemamap: "/schemamap.xml"` is unconditional — the `supportedProtocols` list carries it always (llms precedent: manifest generation precedes dist) |

### Placeholder route filtering (RFC-0917)

Location: `packages/werkstatt-shared/src/routes/template-filter.ts` — exported via `@warpgogol/werkstatt-shared/routes/template-filter`.

| Export | Purpose |
| --- | --- |
| `hasPlaceholderRoutes(routes)` | Detect Astro dynamic route templates (e.g. `[slug]`, `[version]`) that are expanded by generators, not actual pages |

Rules:

- All `system.md` consumers MUST import placeholder detection from `@warpgogol/werkstatt-shared/routes/template-filter`.
- Enforcement: `utility.provenance.validate` (RFC-0916) scans for reimplementations outside the canonical path.

### Client-side dependency import guidance (RFC-0955)

When adding a third-party dependency to `packages/werkstatt-shared/package.json` `dependencies` that is imported by client-side scripts (`src/client-scripts/**/*.ts`) or client-side components (`packages/werkstatt-site/src/domain/ui/components/**/*.client.ts`):

1. Check if the package has a `browser` field in its `package.json` — if yes, no action needed.
2. If no `browser` field, use a deep import to the browser-compatible entry (e.g. `qrcode/lib/browser.js`).
3. If neither is possible, add the package to `optimizeDeps.include` in `astro.config.template.mjs`.
4. Run `vite.client-deps.validate` to verify.

Agents MUST NOT automatically replace imports based on validator output — the validator only reports potential issues. Remediation requires human analysis of the package's export structure.

**Lazy imports are gated too (RFC-1248):** a new `import("<pkg>")` in `src/client-scripts/**` (or a `*.client.ts` component) requires an `optimizeDeps.include` (or `exclude`) declaration in `astro.config.template.mjs` — VITE-CLIENT-DEP-02 blocks otherwise. Non-JS asset specifiers (`.css`, `.svg`, …) are exempt — Vite serves them through the asset pipeline.

### Scroll-spy URL hash updates (RFC-1061)

Location: `packages/werkstatt-shared/src/client-scripts/scroll-spy.ts` — exported via `@warpgogol/werkstatt-shared/client-scripts`.

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

### Orchestrator chunk topology (RFC-1175 AC-5)

`runStandardLayoutOrchestration` is emitted as a **single chunk** — all self-gating feature modules (`scheduler`, `gsap-*`, `inline-number-animation`, `live-photos`, `video-player`, `background-video`, `external-link-qr`, `lordicon`, `lenis`, `scroll-spy`, `external-links`) are **statically** imported so the generated entry script's one `await import("@warpgogol/werkstatt-shared/client-scripts")` resolves the whole dispatch graph in a single hop. Heavy third-party deps (`gsap`, `plyr`, `hls.js`, `@lordicon/element`, `qrcode`, `lenis`) stay lazy **inside each init function** — never hoist them to module top-level, and never add a top-level `import "*.css"` (see `video-player.ts`: `plyr.css` loads inside the Plyr branch). New feature modules follow the same rule: static import in `orchestrator.ts`, lazy heavy deps inside. Structural coverage: `client-scripts/tests/orchestrator-chunks.test.ts`.

`client-scripts/trusted-types.ts` (RFC-1178) defines the named `werkstatt` Trusted Types policy — it is the FIRST static import in `orchestrator.ts` (side-effect import) so the policy exists before any sink write can occur; it MUST never move behind a dynamic import or a lazy feature initializer, and it never creates a `default` policy. Creators accept only platform-branded values minted by the module's `ttHTML`/`ttScriptURL` wrappers — arbitrary strings throw, keeping the policy from degenerating into a pass-through.

### Deep-walk plain-object boundary (ADR-0105)

Any recursive walk that rebuilds objects (`substituteRefsDeep`, `deepMerge`, prop resolvers) MUST rebuild **plain objects only** — objects whose prototype is `Object.prototype` or `null`. Class instances (`Date`, `URL`, custom classes) pass through as leaf values. `Object.entries(new Date())` yields `[]`, so a record-style rebuild silently produces `{}` and the corrupted value flows downstream as `[object Object]` / `Invalid Date` in rendered output. Check the prototype (`Object.getPrototypeOf`), not `Object.prototype.toString` — class instances without `Symbol.toStringTag` still report `[object Object]`. YAML parsers legitimately produce `Date` for unquoted timestamps, so collection data reaching these walks is never plain-object-only. Discovered during warpgogol-m000175: `resolveEntryData` on evidence frontmatter turned `observedAt: Date` into `{}`, shipping `datetime="[object Object]"` to production.

The companion normalization contract lives in `src/content/iso-date-string.ts` — `toIsoDateString(value)` (`@warpgogol/werkstatt-shared/content/iso-date-string` subpath) is the single point for parser-typed date props: `Date` → `toISOString()`, invalid `Date` → `""` (never throws `RangeError`), `string` → passthrough, anything else → `""`. Consumers MUST NOT re-implement the `instanceof Date ? toISOString() : …` fork — two divergent copies (`""` vs `undefined`/`String(v)` fallbacks) were the review finding that extracted this helper.

### Cookie-free referral attribution (RFC-1198)

Location: `packages/werkstatt-shared/src/referral/` — exported via `@warpgogol/werkstatt-shared/referral` and `/referral/copy`.

| Export | Purpose |
| --- | --- |
| `ReferralPartnerSchema` / `ReferralPartnersFileSchema` | Partner record contract: `slug` (`^[a-z0-9]+(-[a-z0-9]+)*$`, 3–32, not in `RESERVED_REFERRAL_SLUGS`), `displayName`, `compensation` (`referral-fee`\|`none`\|`steward`), `locales`, `active`, `publicNameConsentRef`. Slugs MUST be unique file-wide — a duplicate fails schema validation (ambiguous attribution must not silently first-win) |
| `ReferralLandingConfigSchema` | Site-authored `landing` block in partners.yaml: `rewardPhrases`, `stewardRole`, `audiencePhrase`, `conditionsNote` (lang → phrase maps) — economics and legal pointers are site content, never platform literals |
| `loadActiveReferralPartners(globbed, warn?)` | Parses `partners.yaml` bodies → active set. Entry is buildable only when `active === true` AND `publicNameConsentRef` is non-empty — the written-consent gate lives here, not in callers |
| `loadReferralProgramRoutes(globbed)` / `loadReferralLandingConfig(globbed)` | Optional site-authored `programRoutes` map (lang → explainer-page slug) and `landing` copy-facts block; null when undeclared — landings then omit the link / use generic phrases |
| `resolveReferralPartner(rawInput, partners)` | Server-side normalization of the voluntary `referrer` form input → partner or `null` (trim + lowercase, ≤80 chars); raw value still flows as `referrer_uri` for manual review |
| `REFERRAL_SLUG_PATTERN`, `REF_PARAM_PATTERN`, `RESERVED_REFERRAL_SLUGS`, `REFERRER_MAX_LENGTH` | Shared constants — `?ref` prefill and `slug` schema use the same patterns; `RESERVED_REFERRAL_SLUGS` holds platform namespaces only (site route names are site content) |
| `referralLandingCopy(lang, siteName, facts?)` | DE/UK landing copy — `siteName` is the PBP org name; `facts` (from `resolveReferralLandingFacts` + `deriveReferralBenefit`) carries reward/steward/audience/conditionsNote phrases and the PBP partner-program benefit. Absent facts degrade to truthful generic wording; `conditions` is `null` (hidden) when the site declares no benefit — never invent program economics |
| `resolveReferralLandingFacts(config, lang, fallbackLang?)` | Resolves the `landing` block's lang→phrase maps to one language (with fallback chain) — call it once per landing render |

**No-client-storage invariant:** referral attribution carries NO cookies, `localStorage`, `sessionStorage`, or IndexedDB — the chain is `/r/<slug>` → `?ref=<slug>` URL → voluntary form field → server-side slug resolution → `referralPartnerSlug`/`referralPartnerName` on the Lagebild ingress contract. `src/referral/tests/no-cookie-remnants.test.ts` is the enforcement guard; keep the banned-literal list intact.

## Test coverage

RFC-1044 (Phase 2) ratcheted the package adjacency ratio from 29% to 62% by adding 70 adjacent test files across Groups A (share/schemas + ontology/schemas) and B (share/scripts + share/agent + share/knowledge). Groups C-E remain for follow-up sessions. The adjacency baseline is tracked via `.test-adjacency-baseline.json` and enforced by `test.adjacency.validate` (RFC-1040).

## Testing conventions

- **Zod schema tests**: Always inspect the schema definition before writing test data. Test data must match exact field names, required fields, enum values, and optional/nullable constraints. Mismatched test data is the most common cause of test failures in this package.
- **Type inference in tests**: Prefer `z.infer<typeof schema>` over `as Type` casts for typed test data. This ensures type safety and catches schema drift when schemas evolve.
- **Client-side script tests**: Tests for functions that access `document` or `window` require DOM mocking via `vi.stubGlobal` in vitest. Stub `document` and `window` in `beforeEach` and restore with `vi.unstubAllGlobals()` in `afterEach`.
- **IntersectionObserver mock**: Use a `class` with a constructor that pushes the callback and returns an instance object — `vi.fn().mockImplementation()` is NOT a constructor and `new IntersectionObserver()` throws "is not a constructor". Also stub `IntersectionObserver` on both `window` and as a global, since the code checks `"IntersectionObserver" in window`.
- **Element stub for orchestrator tests**: The orchestrator's `has()` helper uses `document.querySelector(selector) instanceof Element`. In Node environment, `Element` is undefined — stub it in `beforeEach` via `vi.stubGlobal("Element", class MockElement {})`.
- **RFC evidence path format**: `rfc.validate` parses evidence paths literally — do NOT wrap paths in backticks. Use `(evidence: test: packages/path/to/file.test.ts)`, not `(evidence: test: \`packages/path/to/file.test.ts\`)`. Backticks cause "references a file that does not exist" errors.
- **Verbund contract conformance**: `src/integration/tests/verbund-contract.test.ts` discovers every `docs/specs/verbund-integration-spec-*` snapshot, builds one `Ajv2020` registry per snapshot (schema `$id`s collide across versions — never share an instance), and validates each fixture in `fixtures/` against the schema its `# fixture-for:` header (or `schema:` field) declares (the vendored schemas are JSON Schema draft 2020-12 — the default `ajv` import is draft-07 and will mis-validate them). All vendored schemas are registered by `$id` so relative `$ref`s resolve; spec paths resolve via `import.meta.url`, never `process.cwd()`. RFC-1239 adds producer-vs-contract drift coverage: the `process_hint` object emitted by `funnelPayloadToProcessHint` is validated against each snapshot's `process-hint.schema.yaml`. PLAN-RFC-1238-01 adds the ingress-payload side: the emitted-surface payload validates against `website-ingress.schema.yaml` on every snapshot that ships one (v0.1.2+), the full derived-type surface validates on the pin (**v0.1.4** — `acquisition` legitimately fails v0.1.2's `additionalProperties: false`), and a `sourceHash` drift gate keeps `lagebild-contracts.types.generated.ts` in sync with the pinned schema bytes (regenerate: `pnpm --filter @warpgogol/werkstatt-shared exec node src/integration/codegen/verbund-contract-types.ts`, then bump `SPEC_VERSION`/PIN on re-vendor). RFC-1241 adds emitted-`acquisition` validation against `acquisition-context.schema.yaml` on each shipping snapshot (v0.1.3+). Relative `$ref`s in v0.1.2+ schemas resolve via per-snapshot namespace aliases; from v0.1.4 every schema `$id` carries the package version (VID-016, AMD-WERKSTATT-04 resolved). A vendored snapshot is immutable — a fixture that fails here is a contract defect; file an amendment under the spec's `amendments/` dir (RFC-0397), never patch the snapshot (VID-013).
