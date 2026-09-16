/*
<MODULE_CONTRACT>
<purpose>
Barrel export for @warpgogol/werkstatt-shared/ontology/schemas sub-path.
Re-exports the Constellation, Biome, SiteFamily, and SystemManifest schemas and types.
</purpose>
<non-goals>
  <item>Do not introduce app-specific runtime composition or deployment behavior into this reusable package source file.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0071: Re-export site-family contract and expanded biome surface.</item>
  <item>RFC-0371: Re-export biome font entry schema and types.</item>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

export { constellationSchema, constellationSlotSchema } from "./constellation.ts";
export type { Constellation, ConstellationSlot } from "./constellation.ts";

export {
  biomeSchema,
  biomeAxesSchema,
  biomeConstraintsSchema,
  biomeFontEntrySchema,
  biomeFontsSchema,
  biomeGeometrySchema,
  biomeMotionSchema,
  biomePaletteSchema,
  biomeProvenanceSchema,
  biomeSiteBackgroundSchema,
  biomeSpacingSchema,
  biomeTypographySchema,
} from "./biome.ts";
export type {
  Biome,
  BiomeAxes,
  BiomeConstraints,
  BiomeFontEntry,
  BiomeFontsConfig,
  BiomeGeometry,
  BiomeMotion,
  BiomePalette,
  BiomeProvenance,
  BiomeSiteBackground,
  BiomeSpacing,
  BiomeTypography,
} from "./biome.ts";

export {
  SiteFamilyContract,
  siteFamilyDetectionSchema,
  siteFamilyRecipeSchema,
  siteFamilySchema,
} from "./site-family.ts";
export type { SiteFamily, SiteFamilyDetection, SiteFamilyRecipe } from "./site-family.ts";

export { sectionArchetypeSchema } from "./section-archetype.ts";
export type {
  SectionArchetypeContract,
  SectionArchetypeId,
  SectionArchetypeLayoutHint,
} from "./section-archetype.ts";

export { systemManifestSchema, systemCollectionSchema } from "./system.ts";
export type {
  SystemManifest,
  SystemPagePin,
  SystemPlanetPin,
  SystemCollectionData,
} from "./system.ts";

// Architecture review 2026-07-10: Re-export growthVendorSchema for @warpgogol/werkstatt-site/growth/config.ts.
export { growthVendorSchema } from "./system.ts";
export type { GrowthVendor } from "./system.ts";

export { PageEntrySchema, BlockEntrySchema } from "./page-entry.ts";
export type { PageEntry, BlockEntry } from "./page-entry.ts";
// getSectionPropsSchema is NOT re-exported here — it lives in manifest-resolver.ts
// which imports node:fs/promises. Re-exporting it from this barrel pulls Node-only
// modules into the Vite client bundle (growth/config.ts imports growthVendorSchema
// from this barrel). Node-side consumers import from
// @warpgogol/werkstatt-shared/ontology/schemas/manifest-resolver directly.

// RFC-0288: Agent Surface closed capability catalog record.
export { capabilityInputOutputSchema, capabilityRecordSchema } from "./capability.ts";
export type { CapabilityInputOutputSchema, CapabilityRecord } from "./capability.ts";

// RFC-0753: DNS record declaration file schema
export {
  dnsRecordTypeSchema,
  dnsRecordDeclarationSchema,
  dnsRecordFileSchema,
} from "./dns-records.ts";
export type { DnsRecordType, DnsRecordDeclaration, DnsRecordFile } from "./dns-records.ts";

// Platform operations schemas (handoff, sternsystem, werkstatt, mission,
// release, leitstand, notausgang, materialization, artifact-store,
// naming-policy) have been extracted to @warpgogol/werkstatt-shared/ontology/operations.
