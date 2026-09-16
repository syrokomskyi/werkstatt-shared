/*
<MODULE_CONTRACT>
<purpose>Growth block schema (RFC-0027) and shared context schema for the system manifest.
Exports growthVendorSchema as the canonical vendor config shape, reused by @warpgogol/werkstatt-site/growth/config.ts.</purpose>
<non-goals>
  <item>Do not introduce app-specific runtime composition or deployment behavior into this reusable package source file.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0303 Phase 3: extracted from schemas/system.ts as part of the domain split.</item>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into <history>, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

export const systemSharedContextSchema = z.object({
  requiredPageIds: z.array(z.string().min(1)).optional().default([]),
});

/**
 * Vendor adapter binding — the canonical schema for the `growth.vendor` block.
 * Shared by systemGrowthSchema (ontology) and GrowthConfigSchema (@warpgogol/werkstatt-site/growth/config.ts).
 *
 * adapter: id of the GrowthAdapter package (e.g. "null", "matomo").
 * options: vendor-specific key/value pairs forwarded to GrowthAdapter.init().
 */
export const growthVendorSchema = z.object({
  adapter: z.string().min(1),
  options: z.record(z.string(), z.string()).optional().default({}),
});

export type GrowthVendor = z.infer<typeof growthVendorSchema>;

/**
 * The `growth:` block in src/content/system.md. Activates the vendor-agnostic growth
 * layer for this app. When absent, <GrowthProvider> is omitted and no events
 * are emitted (null-adapter mode).
 *
 * Example src/content/system.md growth block:
 *   growth:
 *     vendor:
 *       adapter: matomo
 *       options:
 *         proxyBaseUrl: /_wg/analytics/
 *         siteId: "1"
 *         privacyProfile: bannerfrei-v1
 *     funnels:
 *       - donation-intent-to-confirmation
 *     experiments: []
 */
export const systemGrowthSchema = z.object({
  /**
   * Vendor adapter binding — uses the canonical growthVendorSchema.
   */
  vendor: growthVendorSchema,

  /**
   * Funnel ids to activate for this app.
   * Each id must match a file in packages/werkstatt-site/src/domain/ontology/growth/funnels/<id>.yaml.
   * Validated by growth.funnel.validate.
   */
  funnels: z
    .array(z.string().regex(/^[a-z][a-z0-9-]*$/))
    .optional()
    .default([]),

  /**
   * Experiment ids available for this app.
   * Each id must match a file in packages/werkstatt-site/src/domain/ontology/growth/experiments/<id>.yaml.
   * Active experiment assignment per page is resolved server-side.
   * Validated by growth.experiment.validate.
   */
  experiments: z
    .array(z.string().regex(/^[a-z][a-z0-9-]*$/))
    .optional()
    .default([]),
});

export type SystemGrowth = z.infer<typeof systemGrowthSchema>;
