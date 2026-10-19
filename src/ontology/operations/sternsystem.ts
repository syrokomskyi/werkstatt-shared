/*
<MODULE_CONTRACT>
<purpose>
RFC-0354: Zod schemas for the Sternsystem bundle contract — the durable site unit,
fleet registry, and version pin. These schemas are the machine-checkable contract
for all Sternsystem operations.
RFC-0561: fleetRegistryEntrySchema gains optional owner field (did:web VC subject id).
RFC-0574: replace repo/mirror with parameterized mirrors[] array.
RFC-0752: add cloudflareZoneId to fleetRegistryEntrySchema, services[] with subdomains to fleetRegistrySchema.
RFC-0751: extend serviceEntrySchema with deployment fields (kind, url, publicEndpoints, routes, upstreams, lastDeployed, healthCheckPath).
RFC-0790: add systemConfigSchema, systemStateSchema, servicesRegistrySchema for convention-based discovery (replaces fleetRegistrySchema).
</purpose>
<non-goals>
  <item>Do not perform file IO or git operations — pure shape only.</item>
  <item>Do not define mission or release schemas — those live in subsequent RFCs.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1210: closed-loop signal ingest to bounded missions (RFC-1210)</item>
  <item>RFC-1263</item>
  <item>RFC-1284: systemStateSchema gains nullable accessPinSuspended {at,by,operationId} — durable crash-safe suspension marker; accessPin stays the desired-state authority</item>
  <item>RFC-1307: step 1 — shared PBP layout map, canonical writer, typed onboarding state</item>
  <item>RFC-1335: implement RFC-1335: fail-fast editorial gate, adaptive certify budget, gate-bound producer ordering

warpgogol-m000202 burned ~26min of producer capture before the main gate
reported a missing editorial sign-off, and the fixed 40min timeout failed
a passing 112-route capture at 1512.5s.

- shared editorial precondition helper (checkEditorialPrecondition) reads
  packet.json + <release>-editorial.json via schemas sunk to
  werkstatt-shared/ontology/operations (engine cannot import werkstatt-site)
- leitstand.certify --gate main reduces the producer plan to
  editorial-signoff when the precondition is unmet; fail decision names
  editorial.review.prepare/signoff in reasons + nextSteps
- leitstand.promote checks the precondition before loading the
  main-verification decision (ordered authorization)
- adaptive budget clamp(10min + 15s x emittedHtmlCount, 20min, 90min)
  over dist/client/**.html; leitstand.certify.producerBudgetMs override
  (z.unknown so malformed values warn, never fail the config parse);
  40min fallback when the dist tree is absent
- producers whose requirements all declare reuse.allowedFrom: [] sort
  last so gate-bound evidence mints closest to the decision
- AC-6: cache-clone editorial coverage (prepare writes, verify read-only)</item>
  <history>ADR-0091, RFC-0354, RFC-0479, RFC-0561, RFC-0574, RFC-0751, RFC-0752, RFC-0790, RFC-0806, RFC-0902, RFC-0964, RFC-0966, RFC-0967, RFC-1065, RFC-1097</history>
</CHANGE_SUMMARY>
*/

import { z } from "zod";
import { starNameSchema } from "@warpgogol/werkstatt-shared/ontology/cosmic";
import { deploymentStaticConfigSchema, lastPropagatedChannelSchema } from "./leitstand.ts";
import { remediationAutonomyConfigSchema } from "../../remediation/remediation-classes.ts";

const semverRe = /^\d+\.\d+\.\d+$/;
const sha256Re = /^sha256:[0-9a-f]{64}$/;
const kebabRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const didWebRe = /^did:web:[a-z0-9.-]+#.+$/;

export const systemPinSchema = z.object({
  schemaVersion: z.string().min(1),
  systemId: z
    .string()
    .regex(kebabRe, "systemId must be kebab-case, lowercase, latin-only, no TLD suffix"),
  cosmicStar: starNameSchema,
  pinnedAt: z.string().datetime(),
  platform: z.object({
    version: z.string().regex(semverRe, "platform.version must be x.y.z"),
    commit: z.string().min(7),
    rfcHead: z.string().regex(/^RFC-\d{4}$/, "rfcHead must be RFC-NNNN"),
    platformSemanticHash: z
      .string()
      .regex(sha256Re, "platformSemanticHash must be sha256: prefixed hex"),
  }),
  migratorCursor: z.array(z.string()),
  capabilities: z.array(
    z.object({
      semanticId: z.string().min(1),
      version: z.string().min(1),
      intent: z.array(z.string()),
    }),
  ),
});

export const mirrorStorageTypeSchema = z.enum(["non-bare", "bare", "bundle"]);

export type MirrorStorageType = z.infer<typeof mirrorStorageTypeSchema>;

export const mirrorEntrySchema = z.object({
  path: z.string().min(1, "mirror path must be non-empty"),
  storageType: mirrorStorageTypeSchema,
});

export type MirrorEntry = z.infer<typeof mirrorEntrySchema>;

export const serviceSubdomainSchema = z.object({
  domain: z.string().min(1, "subdomain domain must be non-empty"),
  zone: z.string().min(1, "subdomain zone must be non-empty"),
});

export const serviceEntrySchema = z.object({
  id: z
    .string()
    .regex(kebabRe, "service id must be kebab-case, lowercase, latin-only, no TLD suffix"),
  kind: z.enum(["proxy-worker", "scheduled-worker", "cloudflare-worker"]),
  workerName: z.string().min(1, "workerName must be non-empty"),
  hostedBy: z.enum(["studio"]),
  url: z.string().min(1, "url must be non-empty"),
  workersDevUrl: z.string().min(1, "workersDevUrl must be non-empty").optional(),
  publicEndpoints: z.boolean().default(false),
  routes: z.array(z.string()).optional(),
  upstreams: z.array(z.string()).optional(),
  subdomains: z.array(serviceSubdomainSchema).default([]),
  lastDeployed: z
    .object({
      at: z.string().datetime().nullable(),
      state: z.enum(["succeeded", "failed"]).nullable(),
      operationId: z.string().nullable(),
    })
    .default({ at: null, state: null, operationId: null }),
  lastDevDeployed: z
    .object({
      at: z.string().datetime().nullable(),
      state: z.enum(["succeeded", "failed"]).nullable(),
      operationId: z.string().nullable(),
    })
    .default({ at: null, state: null, operationId: null })
    .describe("RFC-0806: last dev-channel deployment state"),
  healthCheckPath: z.string().optional(),
});

// RFC-0790: Convention-based discovery schemas (replaces fleet registry)

// RFC-1275: `integrations` declares sternsystem-level service integrations
// (integrations.journal → CLIENT_JOURNAL [[services]] binding + JOURNAL_TENANT_ID
// var in the generated wrangler config). Loose objects at every level —
// system-config.yaml is the persisted source of truth and schema-driven
// read→write passes (auto-pin, state writes) must preserve extension keys
// declared by newer platform versions rather than silently stripping them.
export const systemConfigIntegrationsSchema = z.looseObject({
  journal: z
    .looseObject({
      service: z.string().min(1, "integrations.journal.service must be non-empty"),
      tenantId: z.string().min(1, "integrations.journal.tenantId must be non-empty"),
    })
    .optional()
    .describe("RFC-1275: client-journal service binding declaration"),
});

export const systemConfigSchema = z.looseObject({
  schemaVersion: z.string().min(1),
  id: z.string().regex(kebabRe, "id must be kebab-case, lowercase, latin-only, no TLD suffix"),
  cosmicStar: starNameSchema,
  mirrors: z.array(mirrorEntrySchema).min(1, "mirrors must contain at least 1 entry"),
  pinnedPlatform: z.string().regex(semverRe, "pinnedPlatform must be x.y.z"),
  status: z.enum(["registered", "active", "paused", "archived"]),
  registeredAt: z.string().datetime(),
  integrations: systemConfigIntegrationsSchema
    .optional()
    .describe("RFC-1275: sternsystem-level service integrations (journal binding, ...)"),
  deployment: deploymentStaticConfigSchema.optional(),
  cloudflareZoneId: z
    .string()
    .min(1, "cloudflareZoneId must be non-empty")
    .optional()
    .describe("Cloudflare zone ID for DNS and Workers route management (RFC-0752)"),
  owner: z
    .string()
    .regex(didWebRe, "owner must be a did:web identifier (did:web:<domain>#<key-version>)")
    .optional()
    .describe("VC subject id of the site owner (RFC-0558, RFC-0561)"),
  notes: z.string().default(""),
  fleet: z
    .object({
      canary: z.boolean().default(false),
    })
    .optional()
    .describe("RFC-0964: fleet wave orchestration config"),
  leitstand: z
    .looseObject({
      certify: z
        .looseObject({
          producerBudgetMs: z
            .unknown()
            .optional()
            .describe(
              "RFC-1335: positive-ms override for the adaptive certify producer budget. " +
                "Typed z.unknown() deliberately — a malformed value (non-number, <=0) must be " +
                "ignored with a warning at read time, never fail the whole config parse.",
            ),
        })
        .optional(),
    })
    .optional()
    .describe("RFC-1335: leitstand runtime overrides"),
});

// Loose for the same reason as systemConfigSchema — system-state.yaml is
// rewritten by writeSystemState* on every state transition; undeclared
// extension keys must round-trip rather than be eaten by parse→write.
export const systemStateSchema = z.looseObject({
  schemaVersion: z.string().min(1),
  systemId: z
    .string()
    .regex(kebabRe, "systemId must be kebab-case, lowercase, latin-only, no TLD suffix"),
  currentMission: z.string().nullable().default(null),
  lastRelease: z.string().nullable().default(null),
  lastPropagated: z
    .object({
      dev: lastPropagatedChannelSchema.optional(),
      alt: lastPropagatedChannelSchema.optional(),
      main: lastPropagatedChannelSchema.optional(),
    })
    .default({}),
  // RFC-0899: 4-digit PIN for dev/alt subdomain access protection. Null when not set.
  accessPin: z
    .string()
    .regex(/^\d{4}$/, "accessPin must be a 4-digit numeric string")
    .nullable()
    .default(null),
  // RFC-1284: transient suspension of access protection. Present only while
  // protection is suspended; accessPin keeps the desired value throughout.
  accessPinSuspended: z
    .object({
      at: z.string(), // ISO-8601 suspension timestamp
      by: z.string(), // invoker, e.g. "leitstand.certify"
      operationId: z.string().nullable().default(null),
    })
    .nullable()
    .default(null),
  // RFC-0966: Controls PASSPORT-01 warning vs blocking. false during rollout,
  // set to true by sternsystem.passport.generate after first successful generation.
  passportRequired: z.boolean().default(false),
  // RFC-0967: Controls OWNERSHIP-01 warning vs blocking. false during rollout,
  // set to true per-site when ready for blocking enforcement.
  ownershipRequired: z.boolean().default(false),
  // RFC-1307: provenance of the werkstatt:intake/v1 bundle the system was
  // born from (sternsystem.register --intake). Undefined for pre-intake systems.
  onboarding: z
    .object({
      intakeId: z.string().regex(/^int_[0-9a-f-]+$/, "intakeId must be int_<uuid>"),
      intakeSha256: z
        .string()
        .regex(/^sha256:[0-9a-f]{64}$/, "intakeSha256 must be sha256:<64 hex>"),
      contractSnapshot: z
        .string()
        .regex(/^sha256:[0-9a-f]{64}$/, "contractSnapshot must be sha256:<64 hex>"),
    })
    .strict()
    .optional(),
  // RFC-1065: Lagebild connection metadata. Undefined when not connected.
  lagebild: z
    .object({
      connected: z.boolean(),
      apiUrl: z.string(),
      tenantId: z.string(),
      sourceSystemId: z.string(),
      connectedAt: z.string(),
      channel: z.string(),
    })
    .optional(),
  // ADR-0091: optional git SHA baseline — commits at-or-older-than this SHA in
  // rev-list order are grandfathered by the external-edit guard (pre-bordbuch
  // history). Operator-set mutable state; no kernel command writes it.
  externalEditBaselineSha: z
    .string()
    .regex(/^[0-9a-f]{40}$/, "externalEditBaselineSha must be a full 40-char lowercase git SHA")
    .optional(),
  // RFC-1263: content fast-lane activation state — absent/"advisory" runs
  // mission.content-edit gates 1–6 and stops before close; "active" also
  // closes the mission. Operator-set per site.
  contentEditLane: z.enum(["advisory", "active"]).optional(),
  // RFC-1210: closed-loop remediation autonomy — opt-in per site. Fields carry
  // their own defaults; an absent block means autonomy: off with the default
  // signal-source allowlist (validated lazily by remediation.autonomy.validate).
  remediation: remediationAutonomyConfigSchema.optional(),
});

export const servicesRegistrySchema = z.object({
  schemaVersion: z.string().min(1),
  services: z.array(serviceEntrySchema),
});

export type SystemPin = z.infer<typeof systemPinSchema>;
export type ServiceSubdomain = z.infer<typeof serviceSubdomainSchema>;
export type ServiceEntry = z.infer<typeof serviceEntrySchema>;
export type SystemConfig = z.infer<typeof systemConfigSchema>;
export type SystemState = z.infer<typeof systemStateSchema>;
export type ServicesRegistry = z.infer<typeof servicesRegistrySchema>;
