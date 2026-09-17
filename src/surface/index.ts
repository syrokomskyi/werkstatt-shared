/*
<MODULE_CONTRACT>
<purpose>[RFC-0192] Public entrypoint for @warpgogol/werkstatt-shared/surface — the Programmatic Surface port.</purpose>
<non-goals>
  <item>Do not perform I/O — consumers (kernel command) supply loaded data.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0284: export fleet Leitstand schemas and types.</item>
  <item>RFC-0264 cleanup: root barrel delegates governance exports to the governance subpath.</item>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — tail packages clean

Sweep batch 3: rewrote ~95 purposes across werkstatt-knowledge, werkstatt-shared, godot-game, phaser-game, lifecycle-core, projektarchiv-*, portal-*, billing-*, typescript (CONTRACT-02/PURPOSE-02). Real KEY_DECISIONS on 5 godot utils, non-goals on 5 CONTRACT-03 files, headers on 4 headerless files, CS-07 history literal fix on 2 files. Policy: vitest.config.ts + test-fixtures testPatterns, worker-configuration.d.ts excludedPath. All non-site/engine packages now 0 diagnostics.</item>
  <item>RFC-1106: step 5 — merge blueprint triplet

surface/blueprint.ts now holds the blueprintSchema (sole declaration), all ~30 contract type names derived via z.infer, parseBlueprint, and the pure helpers. Deleted satellites blueprint-types.ts + blueprint-schema.ts, their package.json export entries, and the zero-consumer site shims (domain/surface/blueprint{,-types,-schema}.ts + 2 load-verification tests). All barrel consumers unchanged.</item>
  <history>RFC-0192, RFC-0271, RFC-0276, RFC-0278, RFC-0280, RFC-0282</history>
</CHANGE_SUMMARY>
*/

export type {
  AxisTuple,
  EligibilityPolicy,
  IndexDecision,
  IndexReason,
  IndustryDossierFields,
  LocalizedSlug,
  LocalizedUniverse,
  PageEntry,
  PageSurfaceProvider,
  RedirectPolicy,
  SurfaceArtifact,
  SurfaceAxis,
  SurfaceBlock,
  SurfaceCounts,
  SurfaceManifest,
  SurfaceNarrative,
  SurfaceRecord,
  SurfaceRecordImage,
  VirtualRouteEntry,
} from "./types.ts";

export {
  buildEligibilityMatrix,
  countMatching,
  enumerateCandidateTuples,
  liveChildrenOf,
  liveSiblingsOf,
  matchesRecord,
  nearestLiveAncestor,
  normalizeSegment,
  pathKey,
  type AxisFieldMap,
  type EligibilityMatrix,
  type MatrixEntry,
} from "./eligibility.ts";

export {
  assembleEntries,
  buildAxes,
  buildAxisFieldMap,
  generateEntries,
  pageIdFor,
  resolvePolicy,
  resolveSlug,
  type Blueprint,
  type BlueprintAxis,
  type BlueprintDemandDepthPolicy,
  type BlueprintDossier,
  type BlueprintDuplicatePolicy,
  type BlueprintEvidenceDepthPolicy,
  type BlueprintIntersectionConfig,
  type BlueprintLevel,
  type BlueprintLinking,
  type BlueprintPillar,
  type BlueprintPillarAdaptation,
  type BlueprintPillarAdaptationDimension,
  type BlueprintPillarFinalCta,
  type BlueprintPillarHero,
  type BlueprintPillarProductPrice,
  type BlueprintPolicy,
  type BlueprintProjection,
  type EnrichedFieldSpec,
  type GeoDepth,
  type IndustryPublicationGate,
  type IntersectionGate,
  type IntersectionSimilarity,
  type LocalizedString,
} from "./blueprint.ts";

export { blueprintSchema, parseBlueprint, type ParseBlueprintResult } from "./blueprint.ts";

// Governance and operational schema bags (RFC-0271..0285) — explicit re-exports.
export type {
  BlueprintModuleClaim,
  PseoStage,
  SurfaceModuleContext,
  SurfaceModules,
  UrlPolicy,
} from "./module-context.ts";
export {
  findDuplicateBlueprintClaims,
  findModuleForBlueprint,
  moduleReviewPolicySchema,
  moduleSiteModeSchema,
  normalizeSurfaceModules,
  pseoStageSchema,
  surfaceModuleContextSchema,
  surfaceModulesSchema,
  urlPolicySchema,
} from "./module-context.ts";

export type {
  DemandAxes,
  DemandIntent,
  DemandSignal,
  DemandSignalSource,
  WerkRecord,
} from "./evidence-records.ts";
export {
  demandAxesSchema,
  demandIntentSchema,
  demandSignalSchema,
  demandSignalSourceSchema,
  werkRecordSchema,
} from "./evidence-records.ts";

export type {
  ApprovalRecord,
  Approver,
  AutonomyLevel,
  AutonomyScope,
  AutonomyState,
  Escalation,
  EscalationBudget,
  EscalationReason,
  FieldClass,
  ReviewInput,
  ReviewVerdict,
} from "./governance.ts";
export {
  approvalRecordSchema,
  approverSchema,
  autonomyLevelSchema,
  autonomyScopeSchema,
  autonomyStateSchema,
  escalationBudgetSchema,
  escalationReasonSchema,
  escalationSchema,
  fieldClassSchema,
  reviewInputSchema,
  reviewVerdictSchema,
} from "./governance.ts";

export type {
  ClusterAction,
  ClusterOutcome,
  VisibilitySnapshot,
  VisibilitySource,
} from "./visibility.ts";
export {
  clusterActionSchema,
  clusterOutcomeSchema,
  visibilitySnapshotSchema,
  visibilitySourceSchema,
} from "./visibility.ts";

export type {
  BreakerVerdict,
  SurfaceState,
  SurfaceStateStatus,
  Tripwire,
  TripwireAction,
} from "./breaker.ts";
export {
  breakerVerdictSchema,
  surfaceStateSchema,
  surfaceStateStatusSchema,
  tripwireActionSchema,
  tripwireSchema,
} from "./breaker.ts";

export type {
  FleetBreakerState,
  FleetJob,
  FleetJobKind,
  FleetPlan,
  FleetSiteStatus,
} from "./fleet.ts";
export {
  fleetBreakerStateSchema,
  fleetJobKindSchema,
  fleetJobSchema,
  fleetPlanSchema,
  fleetSiteStatusSchema,
} from "./fleet.ts";

export {
  buildTokenDocFreq,
  pageText,
  scoreSubstance,
  tokenize,
  type SubstanceComponents,
  type SubstanceScore,
} from "./substance.ts";

export { includeInLlms, includeInTwins, renderTwin, type BlockTwinRenderer } from "./geo.ts";

export {
  composeIndexDecision,
  evaluateBudgetGate,
  evaluateDemandGate,
  evaluateEvidenceGate,
  evaluateFreshnessGate,
  evaluateSubstanceGate,
  type GateResult,
} from "./decision-composer.ts";
