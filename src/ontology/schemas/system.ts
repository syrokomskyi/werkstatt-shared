/*
<MODULE_CONTRACT>
<purpose>
Zod schema for per-app system.yaml — the top-level manifest that binds a client
application to a cosmic identity, a single Biome, and an optional set of
Constellations (DNA-23, RFC-0025). Also declares the growth block (RFC-0027).
Stored at apps/<app-slug>/system.yaml.
</purpose>
<non-goals>
  <item>Do not parse YAML here; the caller is responsible for parsing.</item>
  <item>Do not reference app business logic or client-specific content.</item>
  <item>Do not add rendering logic.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0328: Added "legal" to semanticPageTypeSchema.</item>
  <item>RFC-0303 Phase 3: split the flat 822-line file into sub-modules under system/; this file is now the re-export shim.</item>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

export {
  systemSharedContextSchema,
  systemGrowthSchema,
  growthVendorSchema,
} from "./system/growth.ts";
export type { SystemGrowth, GrowthVendor } from "./system/growth.ts";

export { systemPassportSchema, systemReleaseSchema } from "./system/release.ts";
export type { SystemPassport, SystemRelease } from "./system/release.ts";

export {
  systemTextNormalizeSignalsSchema,
  systemTextNormalizeSchema,
  systemTextSchema,
} from "./system/text.ts";
export type { SystemText } from "./system/text.ts";

export { systemIntegrationsSchema } from "./system/integrations.ts";
export type { SystemIntegrations } from "./system/integrations.ts";

export {
  semanticPageTypeSchema,
  articleMetadataSchema,
  llmsPolicySchema,
  sitemapProjectionSchema,
  robotsProjectionSchema,
  pageOutputSchema,
} from "./system/page-output.ts";

export { systemManifestSchema, systemCollectionSchema } from "./system/manifest.ts";
export type {
  SystemManifest,
  SystemPagePin,
  SystemPlanetPin,
  SystemCollectionData,
} from "./system/manifest.ts";
