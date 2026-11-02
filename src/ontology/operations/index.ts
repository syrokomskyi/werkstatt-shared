/*
<MODULE_CONTRACT>
<purpose>
Barrel export for @warpgogol/werkstatt-shared/ontology/operations sub-path.
Re-exports platform operations schemas: handoff, sternsystem, werkstatt,
mission, release, leitstand, notausgang, materialization, artifact-store,
naming-policy, dht. These schemas have no relationship to UI structural
vocabulary and are consumed primarily by @warpgogol/werkstatt-engine and
site handoff tooling. Sunk from @warpgogol/werkstatt-engine/schemas per
RFC-1104.
</purpose>
<non-goals>
  <item>Do not re-export UI ontology schemas (constellation, biome, page-entry, etc.) — those live in @warpgogol/werkstatt-shared/ontology/schemas.</item>
  <item>Do not re-export diagnostic schemas — those live in @warpgogol/werkstatt-shared/kernel (RFC-1104).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1104: retargeted barrel — platform operations schemas sunk from werkstatt-engine/schemas; diagnostic schemas moved to werkstatt-shared/kernel.</item>
  <item>RFC-1335: implement RFC-1335: fail-fast editorial gate, adaptive certify budget, gate-bound producer ordering

warpgogol-m000202 burned ~26min of producer capture before the main gate
reported a missing editorial sign-off, and the fixed 40min timeout failed
a passing 112-route capture at 1512.5s.

- shared editorial precondition helper (checkEditorialPrecondition) reads
  packet.json + <release>-editorial.json via schemas sunk to
  werkstatt-shared/ontology/operations (engine cannot import werkstatt-site)
- leitstand.certify --gate prod reduces the producer plan to
  editorial-signoff when the precondition is unmet; fail decision names
  editorial.review.prepare/signoff in reasons + nextSteps
- leitstand.promote checks the precondition before loading the
  prod-verification decision (ordered authorization)
- adaptive budget clamp(10min + 15s x emittedHtmlCount, 20min, 90min)
  over dist/client/**.html; leitstand.certify.producerBudgetMs override
  (z.unknown so malformed values warn, never fail the config parse);
  40min fallback when the dist tree is absent
- producers whose requirements all declare reuse.allowedFrom: [] sort
  last so gate-bound evidence mints closest to the decision
- AC-6: cache-clone editorial coverage (prepare writes, verify read-only)</item>
  <item>RFC-1458: emit requirement-mapped verdict events from deploy.smoke.run</item>
  <item>RFC-1492: rename production deploy channel main to prod with single DEPLOY_CHANNELS definition and CHANNEL-01 guard</item>
</CHANGE_SUMMARY>
*/

// RFC-0221: site handoff bundle (lock + authored/derived manifest).
export {
  handoffCapabilitySchema,
  handoffEcosystemSchema,
  handoffBuildSchema,
  handoffLockSchema,
  handoffManifestEntrySchema,
  handoffManifestSchema,
} from "./handoff.ts";
export type {
  HandoffCapability,
  HandoffEcosystem,
  HandoffBuild,
  HandoffLock,
  HandoffManifestEntry,
  HandoffManifest,
} from "./handoff.ts";

// RFC-0354: Sternsystem bundle contract schemas.
export {
  systemPinSchema,
  mirrorStorageTypeSchema,
  mirrorEntrySchema,
  serviceSubdomainSchema,
  serviceEntrySchema,
  systemConfigSchema,
  systemStateSchema,
  servicesRegistrySchema,
} from "./sternsystem.ts";
export type {
  SystemPin,
  MirrorStorageType,
  MirrorEntry,
  ServiceSubdomain,
  ServiceEntry,
  SystemConfig,
  SystemState,
  ServicesRegistry,
} from "./sternsystem.ts";

// RFC-0362: Werkstatt consistency primitive schemas.
export { werkstattLockSchema, werkstattOperationRecordSchema } from "./werkstatt.ts";
export type { WerkstattLock, WerkstattOperationRecord } from "./werkstatt.ts";

// RFC-0355: Mission lifecycle and Bordbuch schemas.
export {
  missionStateSchema,
  missionManifestSchema,
  bordbuchEntryKindSchema,
  bordbuchEntryStatusSchema,
  bordbuchEntrySchema,
} from "./mission.ts";
export type {
  MissionState,
  MissionManifest,
  BordbuchEntryKind,
  BordbuchEntryStatus,
  BordbuchEntry,
} from "./mission.ts";

// RFC-0361: Centralized naming policy regexes and descriptors.
export {
  STERNSYSTEM_ID_REGEX,
  MISSION_ID_REGEX,
  RELEASE_ID_REGEX,
  BORDBUCH_EVENT_ID_REGEX,
  NON_ASCII_REGEX,
  KNOWN_TLDS,
  STERNSYSTEM_ID_POLICY,
  MISSION_ID_POLICY,
  RELEASE_ID_POLICY,
  BORDBUCH_EVENT_ID_POLICY,
  isLatinOnly,
  hasTldSuffix,
} from "./naming-policy.ts";

// RFC-0356: Materialization report schemas.
export {
  materializationReportSchema,
  validationReportSchema,
  authoredDiffSchema,
} from "./materialization.ts";
export type { MaterializationReport, ValidationReport, AuthoredDiff } from "./materialization.ts";

// RFC-0363: Release artifact store schemas.
export { releaseArtifactManifestSchema, releaseArtifactRefSchema } from "./artifact-store.ts";
export type { ReleaseArtifactManifest, ReleaseArtifactRef } from "./artifact-store.ts";

// RFC-0357/RFC-0851: Release discipline and behavior snapshot schemas.
export {
  releaseArtifactStateSchema,
  releaseStateSchema,
  legacyReleaseStateSchema,
  legacyReleaseDiagnosticSchema,
  releaseManifestSchema,
  releaseArtifactRefSchema as releaseArtifactRefSchemaV2,
  behaviorSnapshotDifferenceSchema,
  behaviorSnapshotDiffSchema,
  buildIdentitySchema,
} from "./release.ts";
export type {
  ReleaseArtifactState,
  ReleaseState,
  LegacyReleaseState,
  LegacyReleaseDiagnostic,
  ReleaseManifest,
  BuildIdentity,
  BehaviorSnapshotDifference,
  BehaviorSnapshotDiff,
} from "./release.ts";

// RFC-0358/RFC-0379: Leitstand fleet propagation schemas.
export {
  DEPLOY_CHANNELS,
  deployChannelSchema,
  deploymentAdapterNameSchema,
  deploymentChannelSchema,
  lastPropagatedChannelSchema,
  purgeResultSchema,
  deploymentStaticConfigSchema,
  healthCheckSchema,
  propagationResultSchema,
  routeFactSchema,
} from "./leitstand.ts";
export type {
  DeployChannel,
  DeploymentAdapterName,
  DeploymentChannel,
  LastPropagatedChannel,
  PurgeResult,
  DeploymentStaticConfig,
  HealthCheck,
  PropagationResult,
  RouteFact,
} from "./leitstand.ts";

// RFC-0359: Notausgang export schemas.
export {
  integrationSecretLocationSchema,
  integrationManifestSchema,
  integrationNullingSchema,
  notausgangManifestSchema,
  notausgangEvidenceArtifactSchema,
  notausgangEvidenceVerdictSchema,
  notausgangFeatureNoteSchema,
} from "./notausgang.ts";
export type {
  IntegrationSecretLocation,
  IntegrationManifest,
  IntegrationNulling,
  NotausgangEvidenceArtifact,
  NotausgangEvidenceVerdict,
  NotausgangFeatureNote,
  NotausgangManifest,
} from "./notausgang.ts";

// RFC-1295/RFC-1335: editorial packet + sign-off schemas (single-sourced —
// the engine's leitstand precondition helper cannot import werkstatt-site).
export {
  editorialPacketSchema,
  editorialSignoffSchema,
  protectedContentSchema,
} from "./editorial.ts";
export type { EditorialPacket, EditorialSignoff } from "./editorial.ts";

// RFC-0565: DHT site registry and content placement schemas.
export {
  dhtSiteEntrySchema,
  dhtConfigSchema,
  dhtLookupResultSchema,
  dhtPlacementReasonSchema,
  workshopCapacitySchema,
  dhtPlacementResultSchema,
  dhtCacheEntrySchema,
} from "./dht.ts";
export type {
  DHTSiteEntry,
  DHTConfig,
  DHTLookupResult,
  DHTPlacementReason,
  WorkshopCapacity,
  DHTPlacementResult,
  DHTCacheEntry,
} from "./dht.ts";

// RFC-1458: werkstatt:verdict/v1 requirement-mapped verdict records.
export {
  VERDICT_SCHEMA,
  REQUIREMENT_TAG_PATTERN,
  VERDICT_DETAIL_MAX,
  VERDICT_DETAIL_TRUNCATED,
  boundedDetail,
  verdictOutcomeSchema,
  verdictChannelSchema,
  verdictEventSchema,
} from "./verdict.ts";
export type { VerdictEvent, VerdictOutcome, VerdictChannel } from "./verdict.ts";
