/*
<MODULE_CONTRACT>
<purpose>RFC-0359 + RFC-0380: Zod schemas for Notausgang export manifest and integration manifest. RFC-0380 deepens the manifest schema for deep integrity verification by notausgang.validate.</purpose>
<non-goals>
  <item>Do not introduce app-specific runtime composition or deployment behavior into this reusable package source file.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0359: initial notausgang and integration manifest schemas.</item>
  <item>RFC-0380: schema validated by notausgang.validate for deep integrity verification (schema shape unchanged, already uses STERNSYSTEM_ID_REGEX and RELEASE_ID_REGEX).</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";
import { STERNSYSTEM_ID_REGEX, RELEASE_ID_REGEX } from "./naming-policy.ts";
import { starNameSchema } from "@warpgogol/werkstatt-shared/ontology/cosmic";

export const integrationSecretLocationSchema = z.object({
  file: z.string(),
  jsonPath: z.string(),
  envVar: z.string().optional(),
});

export const integrationManifestSchema = z.object({
  schemaVersion: z.string().min(1),
  integrations: z.record(z.string(), z.array(integrationSecretLocationSchema)),
});

export const integrationNullingSchema = z.object({
  nulled: z.array(z.string()),
  exceptions: z.array(
    z.object({
      name: z.string(),
      reason: z.string(),
    }),
  ),
});

// RFC-1120: per-artifact record inside an evidence bundle verdict
export const notausgangEvidenceArtifactSchema = z.object({
  itemKey: z.string().min(1),
  filename: z.string().min(1).optional(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  recordedSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  r2Path: z.string().min(1).optional(),
  external: z.boolean().optional(),
  url: z.string().min(1).optional(),
});

// RFC-1120: per-source verdict — "bundled" | "external-reference" | "excluded:<reason>"
export const notausgangEvidenceVerdictSchema = z.object({
  verdict: z.string().regex(/^(bundled|external-reference|excluded:.+)$/),
  artifacts: z.array(notausgangEvidenceArtifactSchema).optional(),
});

// RFC-1120: dynamic-feature disclosure entry
export const notausgangFeatureNoteSchema = z.object({
  feature: z.string().min(1),
  verdict: z.enum(["static-ok", "frozen-at-export", "needs-backend"]),
  detail: z.string(),
});

export const notausgangManifestSchema = z.object({
  schemaVersion: z.string().min(1),
  systemId: z.string().regex(STERNSYSTEM_ID_REGEX),
  cosmicStar: starNameSchema,
  releaseId: z.string().regex(RELEASE_ID_REGEX),
  exportedAt: z.string().datetime(),
  platformVersion: z.string(),
  platformSemanticHash: z.string(),
  semver: z.string(),
  source: z.object({
    releaseManifestHash: z.string(),
    artifactManifestHash: z.string(),
    distArtifactHash: z.string(),
    siteContentHash: z.string(),
    behaviorSnapshotHash: z.string(),
  }),
  integrationNulling: integrationNullingSchema,
  distHash: z.string(),
  siteHash: z.string(),
  bordbuchHash: z.string(),
  // RFC-1120: optional in schema (granular NA-* rules report absence);
  // mandatory in packages produced by notausgang.export.
  evidence: z.record(z.string(), notausgangEvidenceVerdictSchema).optional(),
  features: z.array(notausgangFeatureNoteSchema).optional(),
  verifier: z
    .object({
      script: z.literal("verify.py"),
      runtime: z.literal("python3-stdlib"),
      manifestFile: z.literal("notausgang-manifest.json"),
    })
    .optional(),
});

export type IntegrationSecretLocation = z.infer<typeof integrationSecretLocationSchema>;
export type IntegrationManifest = z.infer<typeof integrationManifestSchema>;
export type IntegrationNulling = z.infer<typeof integrationNullingSchema>;
export type NotausgangEvidenceArtifact = z.infer<typeof notausgangEvidenceArtifactSchema>;
export type NotausgangEvidenceVerdict = z.infer<typeof notausgangEvidenceVerdictSchema>;
export type NotausgangFeatureNote = z.infer<typeof notausgangFeatureNoteSchema>;
export type NotausgangManifest = z.infer<typeof notausgangManifestSchema>;
