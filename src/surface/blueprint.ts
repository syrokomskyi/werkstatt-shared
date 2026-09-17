/*
<MODULE_CONTRACT>
<purpose>
  [RFC-0192/0193] The Blueprint contract type (the declarative spec that configures one surface)
  plus the pure helpers that turn a Blueprint + loaded datasets into the eligibility matrix and
  the materialized VirtualRouteEntry[] (routes + redirect decisions). Framework-free. The runtime
  Zod schema and the YAML files live in @warpgogol/werkstatt-shared/ontology (RFC-0193); block baking is added there.
</purpose>
<non-goals>
  <item>Do not parse YAML or validate (ontology owns the Zod schema).</item>
  <item>Do not read content or bake page blocks (the kernel command / RFC-0193 provider does).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0199: resolveSlug/routesFor/assembleEntries/generateEntries take a LocalizedUniverse so URL segments localize per language while identity stays on the neutral tuple.</item>
  <item>RFC-0496: add BlueprintServiceConfig + ServicePublicationGate for website-service depth-1 service dossier configuration; add BlueprintLinkingParent for cross-surface parent linking.</item>
  <item>RFC-0497: add BlueprintIntersectionConfig + IntersectionGate + IntersectionSimilarity for website-local depth-5 intersection gate configuration.</item>
  <item>RFC-0500: add BlueprintHubConfig for depth-0 editorial knowledge hub configuration; add BlueprintStatusGate for record status filtering.</item>
  <item>RFC-1106: step 5 — merge blueprint triplet

surface/blueprint.ts now holds the blueprintSchema (sole declaration), all ~30 contract type names derived via z.infer, parseBlueprint, and the pure helpers. Deleted satellites blueprint-types.ts + blueprint-schema.ts, their package.json export entries, and the zero-consumer site shims (domain/surface/blueprint{,-types,-schema}.ts + 2 load-verification tests). All barrel consumers unchanged.</item>
  <history>RFC-0192</history>
</CHANGE_SUMMARY>
*/

import {
  buildEligibilityMatrix,
  nearestLiveAncestor,
  normalizeSegment,
  pathKey,
  type AxisFieldMap,
  type EligibilityMatrix,
  type MatrixEntry,
} from "./eligibility.ts";
import type {
  AxisTuple,
  EligibilityPolicy,
  LocalizedUniverse,
  SurfaceAxis,
  SurfaceRecord,
  VirtualRouteEntry,
} from "./types.ts";

import { z } from "zod";

// ---------------------------------------------------------------------------
// Blueprint schema — RFC-1106: the sole declaration of the Blueprint contract.
// All Blueprint types below derive from blueprintSchema via z.infer; the former
// blueprint-types.ts / blueprint-schema.ts satellites are merged here.
// ---------------------------------------------------------------------------

const localizedString = z.record(z.string(), z.string());

const intRecord = z.record(z.string(), z.number().int());

// RFC-0490: pillar-hub configuration for depth-0 hub pages.
const pillarCtaSchema = z.object({
  label: localizedString,
  target: z.string().min(1),
});

const pillarHeroSchema = z.object({
  eyebrow: localizedString,
  heading: localizedString,
  lead: localizedString,
  primaryCta: pillarCtaSchema,
  secondaryCta: pillarCtaSchema,
});

const pillarAdaptationDimensionSchema = z.object({
  heading: localizedString,
  body: localizedString,
});

const pillarAdaptationSchema = z.object({
  heading: localizedString,
  dimensions: z.array(pillarAdaptationDimensionSchema).min(1),
});

const pillarProductPriceSchema = z.object({
  heading: localizedString,
  body: localizedString,
  priceRef: z.string().min(1).optional(),
});

const pillarFinalCtaSchema = z.object({
  heading: localizedString,
  body: localizedString,
  primaryCta: pillarCtaSchema,
  secondaryCta: pillarCtaSchema,
});

const pillarSchema = z.object({
  hero: pillarHeroSchema,
  adaptation: pillarAdaptationSchema,
  productPrice: pillarProductPriceSchema,
  finalCta: pillarFinalCtaSchema,
  catalogHeading: localizedString.optional(),
});

// RFC-0492: dossier configuration for depth-1 industry pages.
const industryPublicationGateSchema = z.object({
  minServiceCategories: z.number().int().min(0),
  minCustomerJourneys: z.number().int().min(0),
  minTrustSignals: z.number().int().min(0),
  minArchitectureEntries: z.number().int().min(0),
  minModuleMappings: z.number().int().min(0),
  minUniqueFaq: z.number().int().min(0),
});

const dossierSchema = z.object({
  gate: industryPublicationGateSchema,
  claimRestrictions: z.array(z.string().min(1)),
  doorwayMaxFlaggedShare: z.number().min(0).max(1),
  duplicateMaxSimilarity: z.number().min(0).max(1),
  mode: z.enum(["warn", "fail"]),
});

// RFC-0496: service configuration for depth-1 service dossier pages.
const servicePublicationGateSchema = z.object({
  minServiceVariants: z.number().int().min(0),
  minCustomerQuestions: z.number().int().min(0),
  minPriceModels: z.number().int().min(0),
  minFaq: z.number().int().min(0),
  minPageStructure: z.number().int().min(0),
});

const serviceSchema = z.object({
  gate: servicePublicationGateSchema,
  claimRestrictions: z.array(z.string().min(1)),
  mode: z.enum(["warn", "fail"]),
});

const intersectionGateSchema = z.object({
  minLocalServiceQuestions: z.number().int().min(0),
  minScenarios: z.number().int().min(0),
  minLocalEvidence: z.number().int().min(0),
  minUniqueContentBlocks: z.number().int().min(0),
  minUniqueFaq: z.number().int().min(0),
  minSources: z.number().int().min(0),
});

const intersectionSimilaritySchema = z.object({
  similarityToIndustryPage: z.number().min(0).max(1),
  similarityToCityPage: z.number().min(0).max(1),
  similarityToServicePage: z.number().min(0).max(1),
  similarityToOtherIntersections: z.number().min(0).max(1),
});

const intersectionSchema = z.object({
  gate: intersectionGateSchema,
  similarity: intersectionSimilaritySchema,
  substanceIndependenceThreshold: z.number().min(0).max(1),
  mode: z.enum(["warn", "fail"]),
});

// RFC-0500: hub configuration for depth-0 editorial knowledge hubs (ratgeber).
const hubSchema = z.object({
  cardFields: z.array(z.string().min(1)).min(1),
  reservedSlugs: z.array(z.string().min(1)),
});

// RFC-0500: status gate — only records with allowed statuses are emitted as surface entries.
const statusGateSchema = z.object({
  allowedStatuses: z.array(z.string().min(1)),
  excludedStatuses: z.array(z.string().min(1)),
});

// RFC-0496: cross-surface parent linking.
const linkingParentSchema = z.object({
  surface: z.string().min(1),
  depth: z.number().int().min(0),
  joinField: z.string().min(1),
});

// RFC-0325: static article metadata for a level with no per-record binding (depth-0 hubs).
const blueprintLevelArticleSchema = z.object({
  publishedAt: z.string().min(1),
  updatedAt: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

const evidencePolicySchema = z.object({
  approvedNarrative: z.enum(["required", "optional"]).optional(),
  requiredRecordFields: z.array(z.string().min(1)).optional(),
  preferredEvidenceSources: z.array(z.string().min(1)).optional(),
  minTupleSpecificFacts: z.number().int().min(0).optional(),
  minWerkEvidence: z.number().int().min(0).optional(),
  existenceSource: z.enum(["records", "works"]).optional(),
  freshness: z.enum(["valid-and-current", "valid"]).optional(),
  duplicate: z
    .object({
      method: z.enum(["shingle", "simhash"]).optional(),
      maxSimilarityWithinCluster: z.number().min(0).max(1).optional(),
    })
    .optional(),
  leadImage: z.enum(["required", "warning", "optional"]).optional(),
  mode: z.enum(["error", "warning"]).optional(),
});

const demandPolicySchema = z.object({
  minVolume: z.number().min(0).optional(),
  allowIntents: z
    .array(z.enum(["informational", "commercial", "transactional", "navigational"]))
    .optional(),
  missing: z.enum(["noindex", "do-not-emit"]).optional(),
  staleAfterDays: z.number().int().min(0).optional(),
});

const depthRolePolicySchema = z.object({
  indexability: z.enum(["index", "navigation-noindex", "evidence-gated"]),
  canonicalTarget: z.union([z.literal("tradeHub"), z.number().int().min(0)]).optional(),
  follow: z.boolean().optional(),
  includeInSitemap: z.boolean().optional(),
  geo: z.enum(["full", "twin-only", "off"]).optional(),
  localEvidence: z
    .object({
      minVerifiedFacts: z.number().int().min(0).optional(),
      minCitySpecificQa: z.number().int().min(0).optional(),
      minUniqueTokenShare: z.number().min(0).max(1).optional(),
      maxBodySimilarityWithinBranch: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

export const blueprintSchema = z.object({
  id: z.string().min(1),
  entitlement: z.string().min(1),
  dataset: z.object({ collection: z.string().min(1), status: z.string().optional() }),
  axes: z
    .array(
      z.object({
        id: z.string().min(1),
        universe: z.union([
          z.object({ collection: z.string().min(1), field: z.string().min(1) }),
          z.object({ provider: z.string().min(1) }),
        ]),
        match: z.object({ recordField: z.string().min(1) }),
      }),
    )
    .min(1),
  levels: z
    .array(
      z.object({
        depth: z.number().int().min(0),
        slug: localizedString,
        redirectToPageId: z.string().min(1).optional(),
        constellation: z.string().min(1),
        geo: z.enum(["full", "twin-only", "off"]).optional(),
        titleTemplate: localizedString.optional(),
        descriptionTemplate: localizedString.optional(),
        intro: localizedString.optional(),
        semanticType: z.string().min(1).optional(),
        article: blueprintLevelArticleSchema.optional(),
        pillar: pillarSchema.optional(),
        dossier: dossierSchema.optional(),
        service: serviceSchema.optional(),
        intersection: intersectionSchema.optional(),
        hub: hubSchema.optional(),
      }),
    )
    .min(1),
  policy: z.object({
    minRecordsPerDepth: intRecord,
    noindexBelowPerDepth: intRecord.optional(),
    redirectPolicy: z.enum(["nearest-ancestor", "root"]).optional(),
    trailingSlash: z.boolean().optional(),
    maxStubDepth: z.number().int().optional(),
    substanceMin: z.number().min(0).max(100).optional(),
    substanceMinPerDepth: intRecord.optional(),
    evidencePerDepth: z.record(z.string(), evidencePolicySchema).optional(),
    demandPerDepth: z.record(z.string(), demandPolicySchema).optional(),
    depthRoles: z.record(z.string(), depthRolePolicySchema).optional(),
    sitemapBudget: z.number().int().min(0).optional(),
    maxThinShare: z.number().min(0).max(1).optional(),
    regionalGateDepths: z.array(z.number().int().min(0)).optional(),
    bake: z.enum(["inline", "lazy"]).optional(),
    statusGate: statusGateSchema.optional(),
  }),
  linking: z
    .object({
      children: z.object({ limit: z.number().int() }).optional(),
      siblings: z.object({ limit: z.number().int() }).optional(),
      teasers: z
        .object({
          relevance: z.array(z.object({ sharedAxis: z.string(), weight: z.number() })).optional(),
        })
        .optional(),
      parent: linkingParentSchema.optional(),
    })
    .optional(),
  rotation: z.object({ variantsByTupleHash: z.boolean() }).optional(),
  projection: z
    .object({
      title: localizedString.optional(),
      description: z.union([localizedString, z.object({ ref: z.string() })]).optional(),
    })
    .optional(),
  freshness: z
    .object({
      slaDaysPerDepth: intRecord,
      field: z.string().min(1),
      mode: z.enum(["any", "all", "median"]).optional(),
    })
    .optional(),
  enrichedFields: z
    .array(
      z.object({
        field: z.string().min(1),
        promptId: z.string().min(1),
        scopeDepth: z.number().int(),
        maxTokens: z.number().int(),
        // RFC-0207: output shape + generation granularity (both default to the original behavior).
        kind: z.enum(["field", "narrative"]).optional(),
        scope: z.enum(["tuple", "record"]).optional(),
        axis: z.string().min(1).optional(),
      }),
    )
    .optional(),
});

// ---------------------------------------------------------------------------
// Derived contract types — every name the deleted blueprint-types.ts exported,
// now inferred from the schema above.
// ---------------------------------------------------------------------------

/** A localized string map: lang → value. */
export type LocalizedString = z.infer<typeof localizedString>;

export type Blueprint = z.infer<typeof blueprintSchema>;
export type BlueprintAxis = Blueprint["axes"][number];
export type BlueprintLevel = Blueprint["levels"][number];
export type BlueprintPolicy = Blueprint["policy"];
export type BlueprintLinking = NonNullable<Blueprint["linking"]>;
export type BlueprintProjection = NonNullable<Blueprint["projection"]>;
export type EnrichedFieldSpec = NonNullable<Blueprint["enrichedFields"]>[number];

export type GeoDepth = NonNullable<BlueprintLevel["geo"]>;
export type BlueprintLevelArticle = NonNullable<BlueprintLevel["article"]>;
export type BlueprintPillar = NonNullable<BlueprintLevel["pillar"]>;
export type BlueprintPillarHero = BlueprintPillar["hero"];
export type BlueprintPillarAdaptation = BlueprintPillar["adaptation"];
export type BlueprintPillarAdaptationDimension = BlueprintPillarAdaptation["dimensions"][number];
export type BlueprintPillarProductPrice = BlueprintPillar["productPrice"];
export type BlueprintPillarFinalCta = BlueprintPillar["finalCta"];
export type BlueprintDossier = NonNullable<BlueprintLevel["dossier"]>;
export type IndustryPublicationGate = BlueprintDossier["gate"];
export type BlueprintServiceConfig = NonNullable<BlueprintLevel["service"]>;
export type ServicePublicationGate = BlueprintServiceConfig["gate"];
export type BlueprintIntersectionConfig = NonNullable<BlueprintLevel["intersection"]>;
export type IntersectionGate = BlueprintIntersectionConfig["gate"];
export type IntersectionSimilarity = BlueprintIntersectionConfig["similarity"];
export type BlueprintHubConfig = NonNullable<BlueprintLevel["hub"]>;

export type BlueprintStatusGate = NonNullable<BlueprintPolicy["statusGate"]>;
export type BlueprintLinkingParent = NonNullable<BlueprintLinking["parent"]>;
export type BlueprintEvidenceDepthPolicy = NonNullable<BlueprintPolicy["evidencePerDepth"]>[string];
export type BlueprintDemandDepthPolicy = NonNullable<BlueprintPolicy["demandPerDepth"]>[string];
export type BlueprintDepthRolePolicy = NonNullable<BlueprintPolicy["depthRoles"]>[string];
export type BlueprintDuplicatePolicy = NonNullable<BlueprintEvidenceDepthPolicy["duplicate"]>;

export interface ParseBlueprintResult {
  ok: boolean;
  blueprint?: Blueprint;
  errors: string[];
}

/** Validate an unknown value (parsed YAML) into a typed Blueprint. */
export function parseBlueprint(value: unknown): ParseBlueprintResult {
  const result = blueprintSchema.safeParse(value);
  if (result.success) {
    return { ok: true, blueprint: result.data, errors: [] };
  }
  return {
    ok: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    ),
  };
}

const DEFAULT_SEGMENT_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Resolve the Blueprint policy into a concrete EligibilityPolicy. */
export function resolvePolicy(bp: Blueprint): EligibilityPolicy {
  return {
    minRecordsPerDepth: bp.policy.minRecordsPerDepth,
    noindexBelowPerDepth: bp.policy.noindexBelowPerDepth ?? {},
    redirectPolicy: bp.policy.redirectPolicy ?? "nearest-ancestor",
    trailingSlash: bp.policy.trailingSlash ?? true,
    segmentPattern: DEFAULT_SEGMENT_PATTERN,
  };
}

export function buildAxisFieldMap(bp: Blueprint): AxisFieldMap {
  const map: Record<string, string> = {};
  for (const axis of bp.axes) map[axis.id] = axis.match.recordField;
  return map;
}

/** Build SurfaceAxis[] from a Blueprint and the loaded value universes (axisId → slugs). */
export function buildAxes(
  bp: Blueprint,
  universes: Record<string, readonly string[]>,
): SurfaceAxis[] {
  return bp.axes.map((axis) => ({ id: axis.id, universe: universes[axis.id] ?? [] }));
}

/** Synthetic stable pageId for a (blueprint, depth, tuple). */
export function pageIdFor(
  bp: Blueprint,
  depth: number,
  tuple: AxisTuple,
  axisOrder: readonly string[],
): string {
  if (depth === 0) return `${bp.id}:_root`;
  const values: string[] = [];
  for (let i = 0; i < depth; i += 1) values.push(tuple[axisOrder[i]!] ?? "");
  return `${bp.id}:${values.join(":")}`;
}

function levelByDepth(bp: Blueprint, depth: number): BlueprintLevel | undefined {
  return bp.levels.find((level) => level.depth === depth);
}

function tradeHubDepth(bp: Blueprint): number {
  for (const [depth, role] of Object.entries(bp.policy.depthRoles ?? {})) {
    if (role.indexability === "index") return Number(depth);
  }
  return 1;
}

function canonicalTargetPageId(
  bp: Blueprint,
  entry: MatrixEntry,
  axisOrder: readonly string[],
): string | undefined {
  const role = bp.policy.depthRoles?.[entry.depth];
  if (role?.indexability !== "navigation-noindex") return undefined;
  const targetDepth =
    role.canonicalTarget === "tradeHub"
      ? tradeHubDepth(bp)
      : typeof role.canonicalTarget === "number"
        ? role.canonicalTarget
        : undefined;
  if (targetDepth === undefined || targetDepth >= entry.depth) return undefined;
  return pageIdFor(bp, targetDepth, entry.tuple, axisOrder);
}

/**
 * Resolve a slug template ("website/{industry}/{city}") against a tuple for one language,
 * normalizing each value. RFC-0199: each token's value is the per-language localized slug from
 * `universe` when present, falling back to the neutral tuple value otherwise — so the identity key
 * stays neutral while the emitted URL segment localizes.
 */
export function resolveSlug(
  template: string,
  tuple: AxisTuple,
  lang: string,
  universe: LocalizedUniverse,
  pattern: RegExp,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, axisId: string) => {
    const value = tuple[axisId];
    if (value === undefined) return "";
    const localized = universe[axisId]?.get(value)?.byLang?.[lang] ?? value;
    return normalizeSegment(localized, pattern);
  });
}

/** Localized routes (lang → slug) for one matrix entry. */
function routesFor(
  bp: Blueprint,
  entry: MatrixEntry,
  langs: readonly string[],
  pattern: RegExp,
  universe: LocalizedUniverse,
): Record<string, string> {
  const level = levelByDepth(bp, entry.depth);
  const routes: Record<string, string> = {};
  if (!level) return routes;
  for (const lang of langs) {
    const template = level.slug[lang] ?? level.slug[langs[0]!] ?? "";
    routes[lang] = resolveSlug(template, entry.tuple, lang, universe, pattern);
  }
  return routes;
}

/**
 * Turn the eligibility matrix into materialized VirtualRouteEntry[] (routes + redirect targets).
 * Block baking (entry.page) is layered on by the kernel command / RFC-0193 provider afterwards.
 */
export function assembleEntries(
  bp: Blueprint,
  matrix: EligibilityMatrix,
  langs: readonly string[],
  policy: EligibilityPolicy,
  localizedUniverse: LocalizedUniverse = {},
): VirtualRouteEntry[] {
  const result: VirtualRouteEntry[] = [];
  for (const entry of matrix.entries) {
    const pageId = pageIdFor(bp, entry.depth, entry.tuple, matrix.axisOrder);
    const routes = routesFor(bp, entry, langs, policy.segmentPattern, localizedUniverse);
    const level = levelByDepth(bp, entry.depth);
    const role = bp.policy.depthRoles?.[entry.depth];
    const navigationNoindex = role?.indexability === "navigation-noindex";
    const geo = navigationNoindex ? (role.geo ?? "off") : (level?.geo ?? "full");
    const forcedRedirectToPageId = level?.redirectToPageId;
    const indexable = forcedRedirectToPageId ? false : entry.indexable;
    const noindex = forcedRedirectToPageId || navigationNoindex ? true : entry.noindex;
    const canonicalPageId = canonicalTargetPageId(bp, entry, matrix.axisOrder);
    let redirectToPageId: string | undefined = forcedRedirectToPageId;
    if (!indexable && !redirectToPageId) {
      const ancestor = nearestLiveAncestor(entry, matrix, policy);
      if (ancestor) {
        redirectToPageId = pageIdFor(bp, ancestor.depth, ancestor.tuple, matrix.axisOrder);
      }
    }
    result.push({
      surfaceId: bp.id,
      pageId,
      routes,
      axes: entry.tuple,
      depth: entry.depth,
      recordCount: entry.recordCount,
      indexable,
      noindex,
      geo,
      ...(redirectToPageId ? { redirectToPageId } : {}),
      ...(canonicalPageId ? { canonicalPageId } : {}),
      decision: forcedRedirectToPageId
        ? {
            ...(entry.decision ?? { recordGate: true, indexable: false, noindex: true }),
            indexable: false,
            noindex: true,
            reason: "redirect-stub",
          }
        : navigationNoindex
          ? {
              ...(entry.decision ?? { recordGate: true, indexable: true, noindex: true }),
              indexable,
              noindex: true,
              reason: "navigation-noindex",
            }
          : entry.decision,
    });
  }
  return result;
}

/** Full pipeline: Blueprint + loaded data → VirtualRouteEntry[] (no baked pages). */
export function generateEntries(
  bp: Blueprint,
  data: {
    records: readonly SurfaceRecord[];
    universes: Record<string, readonly string[]>;
    langs: readonly string[];
    /** RFC-0199: per-language slug segments. Absent ⇒ neutral slugs only (legacy behavior). */
    localizedUniverse?: LocalizedUniverse;
    /** RFC-0240: whether the resolved entitlements unlock the regional-hub-or-higher `pseo` tier. */
    regionalUnlocked?: boolean;
  },
): VirtualRouteEntry[] {
  const policy = resolvePolicy(bp);
  const axes = buildAxes(bp, data.universes);
  const axisFieldMap = buildAxisFieldMap(bp);
  const matrix = buildEligibilityMatrix(axes, axisFieldMap, data.records, policy, {
    maxDepth: Math.max(0, ...bp.levels.map((level) => level.depth)),
    maxStubDepth: bp.policy.maxStubDepth ?? 1,
    forceNonIndexableDepths: data.regionalUnlocked ? [] : (bp.policy.regionalGateDepths ?? []),
  });
  return assembleEntries(bp, matrix, data.langs, policy, data.localizedUniverse ?? {});
}

export { pathKey };
