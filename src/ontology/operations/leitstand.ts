/*
<MODULE_CONTRACT>
<purpose>RFC-0358/RFC-0379/RFC-0666: Zod schemas for deployment config, channel model, and propagation results. secretsFile field kept as z.string().optional() for detection (sternsystem.validate rejects any value); secretRefSchema removed as dead code.</purpose>
<non-goals>
  <item>Do not introduce app-specific runtime composition or deployment behavior into this reusable package source file.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1297: lastPropagatedChannelSchema gains states rolled-back + reconciled; healthy becomes nullable (unknown until re-verified).</item>
  <item>RFC-1492: DEPLOY_CHANNELS/DeployChannel/deployChannelSchema — the single channel definition (dev, alt, prod); deploymentStaticConfigSchema.channels built from it.</item>
  <item>RFC-1529: declared host kind contracts + SITE_HOST_KIND propagation

Third SiteHostKind provisional-studio-domain, deployment.hosting schema, isProvisionalKind predicate, declared-kind noindex in access-protection, SITE_HOST_KIND vars token in wrangler template + config-regenerate.</item>
  <item>RFC-1529: declared staging-zone hosting end-to-end</item>
  <item>RFC-1529: close RFC-1529 review r1 findings — declared hosting on all provisional births, zone-required studio schema, wildcard-route warn, strict staging relabel</item>
  <history>RFC-0358, RFC-0379, RFC-0595, RFC-0624, RFC-0627, RFC-0666, RFC-0790, RFC-0926, RFC-1091, RFC-1097</history>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

export const deploymentAdapterNameSchema = z.enum([
  "cloudflare-workers",
  "github-pages",
  "netlify",
  "null",
]);

export const deploymentChannelSchema = z.object({
  workerName: z.string(),
  url: z.string().url(),
  // RFC-0666: secretsFile kept as z.string().optional() for detection — sternsystem.validate rejects any value.
  // secretRefSchema removed (dead code — env vars were never set).
  secretsFile: z.string().optional(),
});

// RFC-1492: the deploy channels, defined exactly once for the whole platform.
// The production channel is "prod" — "main" names only the git branch.
export const DEPLOY_CHANNELS = ["dev", "alt", "prod"] as const;
export type DeployChannel = (typeof DEPLOY_CHANNELS)[number];
export const deployChannelSchema = z.enum(DEPLOY_CHANNELS);

export const purgeResultSchema = z.object({
  success: z.boolean(),
  purgedUrls: z.number(),
  error: z.string().optional(),
});

export const lastPropagatedChannelSchema = z.object({
  releaseId: z.string(),
  at: z.string().datetime(),
  // RFC-1297: nullable — rollback/reconcile record the release but not its
  // health; health is re-established by the next leitstand.verify run.
  healthy: z.boolean().nullable(),
  state: z.enum([
    "succeeded",
    "failed",
    "failed-stale",
    "in-progress",
    "rolled-back",
    "reconciled",
  ]),
  operationId: z.string(),
  leaseExpiresAt: z.string().datetime().nullable(),
  purgeResult: purgeResultSchema.optional(),
  workerVersionId: z.string().optional(),
});

export const healthCheckSchema = z.object({
  name: z.string(),
  url: z.string(),
  status: z.number().int(),
  passed: z.boolean(),
  detail: z.string(),
  expectedHash: z.string().optional(),
  actualHash: z.string().optional(),
});

export const propagationResultSchema = z.object({
  systemId: z.string(),
  releaseId: z.string(),
  state: z.enum(["succeeded", "failed", "failed-stale", "in-progress"]),
  deploymentUrl: z.string(),
  workerVersionId: z.string().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  healthChecks: z.array(healthCheckSchema),
});

export const routeFactSchema = z.object({
  path: z.string(),
  contentHash: z.string().nullable(),
  redirectTarget: z.string().optional(),
});

export type DeploymentAdapterName = z.infer<typeof deploymentAdapterNameSchema>;
export type DeploymentChannel = z.infer<typeof deploymentChannelSchema>;
export type LastPropagatedChannel = z.infer<typeof lastPropagatedChannelSchema>;
export type PurgeResult = z.infer<typeof purgeResultSchema>;

// RFC-1529: provisional host kinds a system may DECLARE on its artifact —
// `custom-domain` is never declared here; it is the absence of this block.
export const siteHostingKindSchema = z.enum([
  "provisional-workers-dev",
  "provisional-studio-domain",
]);

export const deploymentHostingSchema = z
  .object({
    kind: siteHostingKindSchema,
    // e.g. "warpgogol.com" — config-resolved, never a packages literal (HOST-01).
    // Optional at field level: a declared provisional-workers-dev has no
    // studio zone to point at — the superRefine below closes the escape.
    baseDomain: z.string().optional(),
    zoneId: z.string().min(1).optional(),
  })
  .superRefine((hosting, ctx) => {
    if (hosting.kind === "provisional-studio-domain" && (!hosting.baseDomain || !hosting.zoneId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "provisional-studio-domain hosting requires both baseDomain and zoneId",
      });
    }
  });

export type SiteHostingKind = z.infer<typeof siteHostingKindSchema>;
export type DeploymentHosting = z.infer<typeof deploymentHostingSchema>;

export const deploymentStaticConfigSchema = z.object({
  adapter: deploymentAdapterNameSchema,
  // RFC-1492: the channel set is built from DEPLOY_CHANNELS — adding or
  // renaming a channel happens in the tuple above, never in this object.
  channels: z.object(
    Object.fromEntries(
      DEPLOY_CHANNELS.map((channel) => [channel, deploymentChannelSchema]),
    ) as Record<DeployChannel, typeof deploymentChannelSchema>,
  ),
  // RFC-1529: declared host mode — absent ⇔ legacy config (kind derived from
  // the prod channel URL as before); new provisional births always write the block.
  hosting: deploymentHostingSchema.optional(),
});

export type DeploymentStaticConfig = z.infer<typeof deploymentStaticConfigSchema>;
export type HealthCheck = z.infer<typeof healthCheckSchema>;
export type PropagationResult = z.infer<typeof propagationResultSchema>;
export type RouteFact = z.infer<typeof routeFactSchema>;
