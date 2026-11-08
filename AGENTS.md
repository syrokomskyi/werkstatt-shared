# `@warpgogol/werkstatt-shared` — Agent Guide

Stack-agnostic shared infrastructure for the Werkstatt platform: kernel contract types, component contracts, Ed25519 signing, fingerprinting, ontology schemas, and domain utilities (`slug`, `semantic`, `i18n`, `content`, `referral`, `media`, …).

**Workspace type:** Package — expose stable typed APIs; do not import from apps or services.

> This repository is the standalone published form of the package. Issues and PRs are welcome here; the upstream source of truth lives in the Warpgogol werkstatt monorepo.

## Boundary rules

- Leaf package: MUST NOT import from `@warpgogol/werkstatt-site` or `@warpgogol/werkstatt-engine` — the engine depends on it, never the reverse.
- MAY import external packages declared in its own `package.json`.
- Axiom dependencies (`@syrokomskyi/axiom-*`) are `optionalDependencies` — use type-only imports or guard runtime access.

## Canonical homes — consume via subpaths, there is no root `.` export

| Subpath | Contents |
| --- | --- |
| `@warpgogol/werkstatt-shared/kernel` | Command/pipeline types, `WorkspaceIO`, `writeFileAtomic`, `DesiredState`, diagnostics |
| `@warpgogol/werkstatt-shared/component` | `ComponentId`, `CapabilityId`, `EffectClass`, `IsolationTier`, `ComponentDeclaration` |
| `@warpgogol/werkstatt-shared/signing` | Ed25519 core (`generateKeyPair`, `signBytes`, `verifyBytes`, `canonicalBytes`) |
| `@warpgogol/werkstatt-shared/fingerprint` | Hashing primitives, canonical JSON v1 |
| `@warpgogol/werkstatt-shared/ontology/operations` | Platform-ops schemas (sternsystem, mission, release, leitstand, …) |
| `@warpgogol/werkstatt-shared/slug` | `slugUrl`, `slugId`, `HeadingSlugger` — never reimplement slugify |
| `@warpgogol/werkstatt-shared/semantic` | `splitSentences`, `projectClaims`, `formatClaims` |
| `@warpgogol/werkstatt-shared/sections/heading-id` | `sectionHeadingId` — single resolver for heading ids |

## Runtime seam

- **Node-only** modules (`node:*` imports, `createRequire`, subprocess) live under `src/node/` and MUST NOT be re-exported from runtime-agnostic barrels — browser bundles must never see them.
- **Browser-only** modules (DOM, `window`) live under `src/client-scripts/`.
- Everything else → the top-level domain dir matching its responsibility; never a catch-all.
- Persisted schemas in parse→write cycles must preserve forward-compatible fields (loose schema or explicit carry-through) — a strict `z.object` silently drops unknown keys on re-serialization.
- Tests live in `<domain>/tests/` next to their domain.

## Commands

```bash
pnpm install
pnpm run typecheck   # tsc --noEmit
pnpm run lint
pnpm run test        # vitest run
```

Run all three before finishing a change; state environment failures explicitly instead of claiming green.
