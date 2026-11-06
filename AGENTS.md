# `@warpgogol/werkstatt-shared` — Agent Guide

RFC-0868: Stack-agnostic shared infrastructure extracted from `@warpgogol/werkstatt-site`. Owns checks, integration, ontology, passport, share, and surface domains consumed by both the engine and site plugin.

**Workspace type:** Package

This is a **package** workspace. Expose stable typed APIs. Do not import from `werkstatt-site` or services.

> **Budget rule (RFC-1522):** utility catalog detail lives in `docs/agent-guides/werkstatt-shared-*.md` — this file keeps boundaries and layout within the injection budget.

## Boundary rules

- This package MUST NOT import from `@warpgogol/werkstatt-site` — enforced by `werkstatt.shared.validate` (SHARED-03).
- This package MUST NOT import from `@warpgogol/werkstatt-engine` — enforced by `werkstatt.shared.validate` (SHARED-04, RFC-1104). This package is a leaf: the engine depends on it, never the reverse.
- This package MAY import external packages declared in its own `package.json`.

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
| `media` | `@warpgogol/werkstatt-shared/media` | Source-document extraction core (RFC-1345); deterministic slot-placeholder renderer (RFC-1346, `media/placeholder`) |

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

## Topic guides

| Guide | Covers |
| --- | --- |
| `docs/agent-guides/werkstatt-shared-canonical-utilities.md` | Canonical utility catalog (import, do not re-implement) |
| `docs/agent-guides/werkstatt-shared-boundaries.md` | Canonical homes, contract-change ripple, testing conventions |
