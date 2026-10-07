/*
<MODULE_CONTRACT>
<purpose>Site shell contract schema (RFC-1229) for the system manifest.
Declares named shell profiles (required regions + script policy) and the
route→profile binding consumed by site.shell.contract.validate on emitted
dist/client markup.</purpose>
<non-goals>
  <item>Do not validate emitted markup — site.shell.contract.validate owns the postbuild gate.</item>
  <item>Do not declare component region signatures — those live next to shell components in werkstatt-site.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1229: initial shell-contract schema — profiles, routeProfiles, closed-set regions, document-level script policy.</item>
  <item>RFC-1229: step 1 — shellContract schema in systemManifestSchema

Add packages/werkstatt-shared/src/ontology/schemas/system/shell-contract.ts:
closed-set region names, profile shape (regions + document-level script
policy + breadcrumbsScope), routeProfiles closed-set reference check via
superRefine, mode default report. Wire shellContract into
systemManifestSchema and profile into pages[].shell.</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

/**
 * The `shellContract:` block in src/content/system.md (RFC-1229).
 *
 * Example:
 *   shellContract:
 *     mode: strict
 *     profiles:
 *       default:
 *         regions: [header, footer, background, breadcrumbs]
 *         breadcrumbsScope: non-home
 *         scripts: required
 *       no-script:
 *         regions: [header, footer, background]
 *         scripts: forbidden
 *       bare:
 *         regions: [header, footer]
 *         scripts: required
 *     routeProfiles:
 *       "r/**": no-script
 *       "**\/r/**": no-script
 *       "404.html": bare
 */
export const shellRegionNameSchema = z.enum([
  "header",
  "footer",
  "background",
  "breadcrumbs",
]);

export type ShellRegionName = z.infer<typeof shellRegionNameSchema>;

export const systemShellProfileSchema = z.object({
  /**
   * Closed set: regions that MUST be present on routes bound to this profile.
   * Regions not listed here are FORBIDDEN (SITE-SHELL-02).
   */
  regions: z.array(shellRegionNameSchema),
  /**
   * Document-level script policy (shell scripts are emitted outside their
   * region element — e.g. the header's <script> lands after </header> — so
   * the check applies to the emitted document, not a region):
   *   required  — at least one <script> element must be emitted
   *   forbidden — zero <script> elements
   *   optional  — either variant allowed; the validator detects which one
   */
  scripts: z.enum(["required", "forbidden", "optional"]),
  /**
   * breadcrumbs only: whether the band is required on non-home routes.
   * "non-home" = every emitted route except the home twins (index.html at
   * dist root and <lang>/index.html).
   */
  breadcrumbsScope: z.enum(["all", "non-home"]).optional(),
});

export type SystemShellProfile = z.infer<typeof systemShellProfileSchema>;

export const systemShellContractSchema = z
  .object({
    /**
     * Gate severity. Default when the block is absent: "report" (warnings,
     * exit 0) — existing sites adopt without a flag day. "strict" fails the
     * build on error-severity diagnostics; "off" is an explicit no-op.
     */
    mode: z.enum(["strict", "report", "off"]).default("report"),
    /**
     * Named profiles. "default" is the implicit fallback for unmatched
     * routes — declare it explicitly to tighten it.
     */
    profiles: z.record(z.string().min(1), systemShellProfileSchema),
    /**
     * URL-path glob → profile name. Matched against the emitted route path
     * without leading slash ("r/ostpost/", "uk/r/ostpost/"); "**" crosses
     * segments so localized twins need their own pattern ("**\/r/**").
     * First match wins; pages[].shell.profile outranks globs.
     */
    routeProfiles: z.record(z.string().min(1), z.string().min(1)).optional(),
  })
  .superRefine((contract, ctx) => {
    for (const [pattern, profileName] of Object.entries(contract.routeProfiles ?? {})) {
      if (!(profileName in contract.profiles)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["routeProfiles", pattern],
          message: `routeProfiles pattern "${pattern}" references undeclared profile "${profileName}"`,
        });
      }
    }
  });

export type SystemShellContract = z.infer<typeof systemShellContractSchema>;
