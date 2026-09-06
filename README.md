# @warpgogol/werkstatt-shared

[Українська](README.uk.md) | English

Stack-agnostic shared infrastructure extracted from `werkstatt-site` (RFC-0868). Owns checks, integration, ontology, passport, share, and surface domains consumed by both the Werkstatt engine and the site plugin.

> Engineered at [Warpgogol](https://warpgogol.com) · Released as open source.

---

## What this package does

This is a **shared infrastructure library** used by the [Werkstatt](https://www.npmjs.com/package/@warpgogol/werkstatt) engine and the `werkstatt-site` plugin. It provides:

- **Checks** — content validators, SEO validators, surface expand/bake logic
- **Integration** — CRM, funnel, hub, sharding, QStash adapters
- **Ontology** — catalogs, enums, Sternsystem owner types
- **Passport** — DHT signing, identity signing, schema validation
- **Share** — slug generation, semantic extraction, URL canonicalization, route filtering, middleware, access protection
- **Surface** — surface expand/bake helpers and labels

You don't use this package on its own — it is consumed by the engine and site plugin as a dependency.

---

## Installation

```sh
pnpm add @warpgogol/werkstatt-shared
```

This package is installed automatically when you install `@warpgogol/werkstatt` or `@warpgogol/werkstatt-site`.

---

## How it fits into the Werkstatt ecosystem

| Package | Role |
| --- | --- |
| `@warpgogol/forge` | Governance layer — skills, RFC/ADR workflows, CLI, project scaffolding |
| `@warpgogol/werkstatt` | Runtime engine — missions, releases, deployment, certification, Bordbuch |
| `@warpgogol/werkstatt-shared` | **This package** — shared infrastructure (checks, integration, ontology, passport, share) |
| `@warpgogol/werkstatt-site` | Astro site plugin — consumes this package for checks, integration, ontology, passport, share |

The engine and site plugin both import from this package. It MUST NOT import from `werkstatt-site` — enforced by `werkstatt.shared.validate`.

---

## Canonical utilities

### Slug generation (RFC-0915, DNA-88)

| Export | Purpose |
| --- | --- |
| `slugUrl(text, lang?)` | Locale-aware URL slug (German umlauts, Ukrainian transliteration, default) |
| `slugId(text)` | Semantic block ID slug |
| `HeadingSlugger` | Stateful heading anchor deduplication |

```ts
import { slugUrl } from "@warpgogol/werkstatt-shared/share/slug";

const url = slugUrl("Über uns", "de"); // "ueber-uns"
```

### Semantic extraction (RFC-0901)

| Export                          | Purpose                                                     |
| ------------------------------- | ----------------------------------------------------------- |
| `splitSentences(text, locale?)` | Locale-aware sentence boundary detection (`de`, `uk`, `en`) |

### Canonical entity URL (RFC-0910)

| Export                      | Purpose                                         |
| --------------------------- | ----------------------------------------------- |
| `canonicalRootUrl(baseUrl)` | Unprefixed root URL for JSON-LD entity identity |

### Placeholder route filtering (RFC-0917)

| Export                         | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `hasPlaceholderRoutes(routes)` | Detect Astro dynamic route templates (`[slug]`, `[version]`) |

---

## Architecture

| Directory          | Purpose                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| `src/index.ts`     | Main barrel export                                                          |
| `src/checks/`      | Content validators, SEO validators, surface expand/bake                     |
| `src/integration/` | CRM, funnel, hub, sharding, QStash adapters                                 |
| `src/ontology/`    | Catalogs, enums, Sternsystem owner types                                    |
| `src/passport/`    | DHT signing, identity signing, schema validation                            |
| `src/share/`       | Slug, semantic, URL canonicalization, routes, middleware, access protection |
| `src/surface/`     | Surface expand/bake helpers and labels                                      |
| `src/content/`     | SystemManifest types and content schema                                     |

---

## Boundary rules

- This package MUST NOT import from `@warpgogol/werkstatt-site` — enforced by `werkstatt.shared.validate`.
- This package MAY import from `@warpgogol/werkstatt` (engine) and external packages.
- Axiom dependencies (`@syrokomskyi/axiom-*`) are `optionalDependencies` — consumers without axiom installed must use type-only imports or guard runtime access.

---

## Publishing to npm

This package is published to the npm registry as `@warpgogol/werkstatt-shared`. Publishing is automated via GitHub Actions CI.

### How it works

1. The source lives in the [warpgogol/werkstatt](https://github.com/syrokomskyi/werkstatt) monorepo under `packages/werkstatt-shared/`.
2. [`@warpgogol/repo-extract`](https://github.com/syrokomskyi/repo-extract) extracts the package into the standalone [syrokomskyi/werkstatt-shared](https://github.com/syrokomskyi/werkstatt-shared) repository, flattening it to repo root and stripping workspace dependencies.
3. The generated GitHub Actions CI workflow runs on every push to `main`: lint → typecheck → build → test → `npm publish --provenance --access public`.
4. The `NPM_TOKEN` secret must be set in the [repository settings](https://github.com/syrokomskyi/werkstatt-shared/settings/secrets/actions).

### Triggering a new release

From the werkstatt monorepo root:

```sh
# 1. Bump the version in packages/werkstatt-shared/package.json
# 2. Run the extraction (extracts + commits + pushes to github.com:syrokomskyi/werkstatt-shared.git)
pnpm exec repo-extract --config packages/werkstatt-shared/extract.config.yaml --verbose

# 3. CI picks up the push and publishes to npm automatically
```

After CI completes, verify the new version on [npmjs.com/package/@warpgogol/werkstatt-shared](https://www.npmjs.com/package/@warpgogol/werkstatt-shared).

---

## License

Apache-2.0

## Open Engineering

This package originated from production engineering work at [Warpgogol](https://warpgogol.com), an engineering studio in Germany.

We publish reusable parts of our infrastructure when they can be useful beyond our own projects. It is published independently of any Warpgogol commercial service. Using this package does not create any dependency on Warpgogol.

Built for real systems. Shared openly.
