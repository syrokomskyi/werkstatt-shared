/*
<MODULE_CONTRACT>

<purpose>Zod model of the werkstatt:intake/v2 hand-over envelope (RFC-1281 +
RFC-1342/AMD-007, spec werkstatt-onboarding ON-01 / INTAKE-CONTRACT, AMD-001 §1)
— the single producer → Werkstatt contract. Owns every envelope field of the
three normative v0.1.0 spec schemas; pbp[] entities are checked at envelope
level only (schema allow-list, id, type, status). Also renders the JSON Schema
export that producers vendor byte-exact
(intake.schema.generated.yaml, owner command onboarding.intake.schema.export).</purpose>
<non-goals>
  <item>Do not redeclare PBP entity shapes (DNA-103) — full entity validation runs in @warpgogol/werkstatt-engine via pbpSchemaById (INTAKE-03); this package cannot import @warpgogol/pbp without a dependency cycle.</item>
  <item>Do not touch the filesystem or run bundle-level checks — INTAKE-01…34 live in @warpgogol/werkstatt-engine.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>pbp[] entities are checked at envelope level only</item>
  <item>Entity JSON Schemas are injected by the engine (RFC-1301) as $defs of the same export</item>
  <item>Zod is the source of truth (spec D2)</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1408/AMD-015: voice.contractSeed — optional producer-projected translation seed (terms/doNotTranslate/forbiddenPhrases/notesByLocale).</item>
  <item>RFC-1368 review r2: non-goal rule range updated to INTAKE-01…34.</item>
  <item>RFC-1357/AMD-012: first-fold art direction — required visual.artDirection (firstFold composition/surface/textSide/imageSubject/slotRef, imagery style/avoid, mockAssetRef); slotBriefs gain required placement + subjectKind and optional framing; subjectKind ⇔ role schema binding (represented-product only on depicts-represented-product); LAYOUT_VOCABULARY export for INTAKE-30.</item>
  <item>RFC-1353/AMD-011: faq block — intakeFaqTopicSchema/intakeFaqEntrySchema (status conditionals), faqEntryTier(), envelope faq:, provenance.familyQuestionsSnapshot.</item>
  <item>RFC-1345/AMD-009: v2 asset cut — origin gains `extracted` (+derivedFrom provenance, schema-required iff extracted); `mediaHints` on kind:document; `depicts` required on image-bearing kinds (photo/product-photo/illustration); rights.gapRef replaced by rights.blockers[]; export title corrected to "Werkstatt Intake v2 envelope" in the pbpEntitySchemas branch.</item>
  <item>RFC-1342/AMD-007: werkstatt:intake/v2 cut — gap.kind typed (proof/rights/approval/scope-extension/operational); annotation gapRef replaced by blockers[] (≥1 on every non-published non-internal entity, schema-level) + ceiling draft|preview; operatorDecisions gain required effect plus appliesTo and grantsTier (conditional superRefine); pageSetIntent gains optional entityRefs; voice profile toneOfVoice/culturalRules non-null again; INTAKE-13 coverage widened to ceiling:preview entities.</item>
  <item>RFC-1346/AMD-010: slotBriefs[] on the envelope — deferred image-fulfilment briefs (role atmosphere|illustration|depicts-represented-product, aspectHint, preferredSources/awaitingGap); superRefine forbids prompt on depicts-represented-product and requires sources-or-gap there.</item>
  <item>RFC-1353: steps 4-5 — composition FAQ gates + family.questions.export

werkstatt-site: COMP-FAQ-01 (publishable topic requires a faq-list block
tag:<topic.id> at its placement — verbatim pageSetIntent matching + literal
faq->slug faq, escape only via a decided obligation citing the topic with a
proof blocker or hard-stop; warning during the one-birth grace via
COMP_FAQ_01_SEVERITY) + COMP-FAQ-02 (all-draft topic warning); COMP-QUESTIONS-01
counts placed non-draft entries carrying visitorQuestionRef within the
question's scope; publication register reader joins the faq: section for the
escape's blocker lookup; ComposedBlock gains tag. family.questions.export
renders family-visitor-questions.generated.yaml from every site-families/*
family.yaml visitorQuestions block — same-id merge with families union,
FAMILYQ-EXPORT-01 refuses colliding prompts without writing, deterministic
sourceHash, generated header. werkstatt-engine: contract.ripple.apply gains the
family-questions-export step before spec-mirror; spec-mirror extends to
multi-file mirroring with sorted integrity-entry append and rendered-bytes
hashing under --dry-run. wg-onboard documents one faq-list per topic and the
no-invented-answers rule; knowledge-graph + verification-plan updated.
Review: docs/reviews/code/packages-werkstatt-site/review-2026-10-20-19-41-packages-werkstatt-site.md
Tests-Skipped trailer: the scoped gate runs the full site suite, which fails
on pre-existing queue.validate io-mutation debt (reproduced on clean HEAD
093850723) — unrelated to this diff. Focused suites green: site 49/49
(composition-validate + family-questions-export), engine 129/129
(contract-ripple + intake-validate + register-intake); ripple dry-run all
synced; rfc.acceptance.run 16 probes 0 failed.</item>
  <history>ADR-0114, RFC-1281, RFC-1298, RFC-1301, RFC-1328</history>
</CHANGE_SUMMARY>
*/

import { z } from "zod";
import YAML from "yaml";

export const INTAKE_SCHEMA_ID = "werkstatt:intake/v2" as const;

/**
 * v1 allow-list of PBP schema ids an intake pbp[] entry may carry
 * (spec: pbpEntity.schema enum). Widening needs a spec amendment.
 */
export const INTAKE_PBP_SCHEMA_ALLOWLIST = [
  "pbp/business@1",
  "pbp/legal-identity@1",
  "pbp/offering@1",
  "pbp/claim@1",
  "pbp/evidence-source@1",
  "pbp/disclosure@1",
  "pbp/contact-point@1",
  "pbp/brand@1",
] as const;

// ---------------------------------------------------------------------------
// $defs (byte-identical patterns to docs/specs/werkstatt-onboarding/schemas/)
// ---------------------------------------------------------------------------

const bcp47Tag = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$/);

const sha256Digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);

/** Evidence-source PBP entity id backing a statement. */
const sourceRef = z.string().min(1);

const verbatimSchema = z
  .object({
    /** Byte-exact substring of the referenced source file (INTAKE-05). */
    text: z.string().min(1),
    sourceRef,
    speaker: z.enum(["client", "studio", "third-party"]).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// classification
// ---------------------------------------------------------------------------

const classificationLocaleSchema = z
  .object({
    tag: bcp47Tag,
    role: z.enum(["primary", "secondary"]),
    sourceLanguageBy: z.enum(["client", "studio", "translation"]),
    reviewer: z.enum(["client", "studio", "external", "unassigned"]),
    evidenceRefs: z.array(sourceRef).optional(),
  })
  .strict();

const classificationSchema = z
  .object({
    locales: z.array(classificationLocaleSchema).min(1),
    jurisdiction: z.string().regex(/^[A-Z]{2}$/),
    markets: z
      .array(
        z
          .object({
            market: z.string(),
            confidence: z.enum(["high", "medium", "low", "unknown"]),
          })
          .strict(),
      )
      .optional(),
    audiences: z.array(z.string()).optional(),
    conversionModel: z.enum([
      "information-only",
      "inquiry",
      "booking",
      "donation",
      "ecommerce",
      "referral",
    ]),
    hasEcommerce: z.boolean().optional(),
    existingSite: z.union([z.string(), z.null()]).optional(),
    domain: z.union([z.string().regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/), z.null()]).optional(),
    profile: z.enum(["visitka", "standard", "asset-grade"]),
    pageSetIntent: z
      .array(
        z
          .object({
            intent: z.string(),
            evidenceRefs: z.array(sourceRef),
            /**
             * RFC-1342/AMD-007: PBP entity ids the intent page is meant to
             * present — the typed composition coverage edge.
             */
            entityRefs: z.array(z.string().min(1)).optional(),
          })
          .strict(),
      )
      .min(1),
    materialMentions: z.array(z.string()).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// pbp[] entities — envelope-level check only (DNA-103, AMD-001 §1)
// ---------------------------------------------------------------------------

export const intakePbpEntitySchema = z.looseObject({
  schema: z.enum(INTAKE_PBP_SCHEMA_ALLOWLIST),
  id: z.string().min(1),
  type: z.string(),
  status: z.enum(["draft", "published", "superseded"]),
  /**
   * AMD-005/RFC-1328: per-locale value of the entity's statement field
   * (`statement`, else `summary`) for published entities — keyed by the
   * BCP 47 tags of `classification.locales`. The root statement field is
   * the primary-locale value; this map covers the rest. Optional — an
   * entity without it is either `localeNeutral` or INTAKE-13.
   * RFC-1342/AMD-007: `ceiling: preview` entities are covered too (INTAKE-18).
   */
  statementByLocale: z.record(bcp47Tag, z.string().min(1)).optional(),
  /**
   * AMD-005/RFC-1328: the statement is a name/identifier/address — the same
   * string is correct in every locale (INTAKE-13 exempt).
   */
  localeNeutral: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// annotations / operatorDecisions
// ---------------------------------------------------------------------------

const gapId = z.string().regex(/^GAP-[0-9]{2,}$/);

const annotationSchema = z
  .object({
    verbatim: z.array(verbatimSchema).optional(),
    /**
     * RFC-1342/AMD-007: gaps whose closure publishes this entity. Required
     * (≥1) on every non-published, non-internal entity — enforced on the
     * envelope superRefine (INTAKE-02); a draft with no blockers is a
     * contract defect, not a semantic violation.
     */
    blockers: z.array(gapId).min(1).optional(),
    /**
     * RFC-1342/AMD-007: upper bound this entity may render at — `draft`
     * (default when absent) or `preview`. `public` is unreachable from the
     * intake: only `status: published` publishes.
     */
    ceiling: z.enum(["draft", "preview"]).optional(),
    /** Composer context only — never publishable (D10 gate). */
    internal: z.boolean().optional(),
    /** Originating evidence-ledger record id (e.g. CLM-023). */
    ledgerRef: z.string().optional(),
  })
  .strict();

const OPERATOR_DECISION_EFFECTS = [
  "content-scope",
  "publication-tier",
  "process",
  "commercial",
  "other",
] as const;

const operatorDecisionSchema = z
  .object({
    id: z.string().regex(/^(OPD|DEF)-[0-9]{2,}$/),
    kind: z.enum(["ruling", "default", "gate-verdict"]),
    gate: z.string(),
    question: z.string(),
    recommendation: z.string().optional(),
    answer: z.string(),
    answeredAt: z.iso.datetime().optional(),
    reversible: z.boolean().optional(),
    /** RFC-1342/AMD-007: what the ruling affects. */
    effect: z.enum(OPERATOR_DECISION_EFFECTS),
    /**
     * RFC-1342/AMD-007: entity, gap, or asset ids the ruling applies to.
     * Required on `content-scope` and `publication-tier` effects.
     */
    appliesTo: z.array(z.string().min(1)).min(1).optional(),
    /**
     * RFC-1342/AMD-007: tier the ruling grants — required on
     * `effect: publication-tier`, forbidden otherwise (INTAKE-20's input).
     */
    grantsTier: z.enum(["preview", "public"]).optional(),
  })
  .strict()
  .superRefine((decision, ctx) => {
    const scoped =
      decision.effect === "content-scope" || decision.effect === "publication-tier";
    if (scoped && !decision.appliesTo) {
      ctx.addIssue({
        code: "custom",
        message: `appliesTo is required when effect is '${decision.effect}'`,
        path: ["appliesTo"],
      });
    }
    if (decision.effect === "publication-tier" && !decision.grantsTier) {
      ctx.addIssue({
        code: "custom",
        message: "grantsTier is required when effect is 'publication-tier'",
        path: ["grantsTier"],
      });
    }
    if (decision.effect !== "publication-tier" && decision.grantsTier !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "grantsTier is forbidden unless effect is 'publication-tier'",
        path: ["grantsTier"],
      });
    }
  });

// ---------------------------------------------------------------------------
// voice
// ---------------------------------------------------------------------------

const voiceVerbatimSchema = z
  .object({
    id: z.string().regex(/^VOI-[0-9]{2,}$/),
    text: z.string(),
    sourceRef,
    use: z.string(),
    claimRefs: z.array(z.string()).optional(),
    /**
     * ADR-0114 / handoff W3: machine-readable clearance. `visibility` is the
     * blanket classification; `clearedFor` names the public surfaces the line
     * may occupy (chrome motto/tagline slots, hero tagline, page copy);
     * `blockedBy` names the claim/decision ids holding the line back.
     * Optional — pre-W3 bundles carry `use` prose only and the composer
     * judges clearance from it (COMP-VOICE-01).
     */
    visibility: z.enum(["public", "internal", "conditional"]).optional(),
    clearedFor: z.array(z.string()).optional(),
    blockedBy: z.array(z.string()).optional(),
  })
  .strict();

const voiceDirectiveSchema = z
  .object({
    id: z.string().regex(/^DIR-[0-9]{2,}$/),
    text: z.string(),
    sourceRef,
    appliesTo: z.array(z.enum(["composition", "publication", "visual", "research"])),
  })
  .strict();

const voiceProfileSchema = z
  .object({
    /**
     * RFC-1342/AMD-007: populated profile, always — the ADR-0114 null
     * tolerance (mistaken W3 report) is removed with the v2 cut.
     */
    toneOfVoice: z
      .object({
        tone: z.string(),
        posture: z.string(),
        readingLevel: z.string(),
        avoids: z.array(z.string()),
        prefers: z.array(z.string()),
      })
      .strict(),
    /** Rules per BCP 47 locale tag (spec: propertyNames bcp47). */
    linguisticRules: z.record(bcp47Tag, z.array(z.string())),
    culturalRules: z.array(z.string()),
  })
  .strict();

const voiceSchema = z
  .object({
    // AMD-015/RFC-1408: producer-projected translation-contract seed.
    contractSeed: z
      .object({
        terms: z.array(z.object({ term: z.string(), translation: z.string() }).strict()).optional(),
        doNotTranslate: z.array(z.string()).optional(),
        forbiddenPhrases: z.array(z.string()).optional(),
        notesByLocale: z.record(bcp47Tag, z.string()).optional(),
      })
      .strict()
      .optional(),
    verbatim: z.array(voiceVerbatimSchema),
    directives: z.array(voiceDirectiveSchema),
    profile: voiceProfileSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// visual — axes keys are the biomeAxesSchema key set; the live schema check
// is INTAKE-08 in the engine (spec delegates the shape to biomeAxesSchema).
// ---------------------------------------------------------------------------

const INTAKE_VISUAL_AXES_KEYS = [
  "warmth",
  "contrast",
  "density",
  "typographySharpness",
  "diagramPresence",
  "photoStance",
  "motionStance",
  "textContrast",
  "cornerRadius",
  "borderWeight",
] as const;

/**
 * RFC-1357/AMD-012: the closed page-layout vocabulary refused inside image
 * prompts and art-direction subject/style prose (INTAKE-30) — image models
 * render layout words literally (the dp7 "rounded-corner panel" failure).
 * Whole-word / whole-phrase, case-insensitive. Exported so the validator and
 * the AMD text share one list.
 */
export const LAYOUT_VOCABULARY = [
  "headline",
  "heading",
  "text overlay",
  "overlay",
  "layout",
  "web page",
  "website",
  "user interface",
  "ui",
  "panel",
  "rounded corner",
  "rounded-corner",
  "mockup",
  "mock-up",
  "banner",
  "reserved for",
  "negative space for",
  "copy space for",
] as const;

/**
 * RFC-1357/AMD-012: the approved first-fold direction decided at G-V — an
 * abstract vocabulary (`text-beside-image`, not a Werkstatt prop name) that
 * `biome.from-intake` maps onto hero variants. `slotRef` is present iff
 * `composition` is not `text-only` (INTAKE-33).
 */
export const artDirectionSchema = z
  .object({
    firstFold: z
      .object({
        composition: z.enum(["text-beside-image", "text-over-image", "text-only"]),
        surface: z.enum(["light", "dark"]),
        textSide: z.enum(["left", "right"]),
        /** What the first-fold image shows — no layout words (INTAKE-30). */
        imageSubject: z.string().min(1).max(240),
        /** The first-fold slot brief id (INTAKE-31/33). */
        slotRef: z.string().regex(/^SLOT-[0-9]{2,}$/).optional(),
      })
      .strict(),
    imagery: z
      .object({
        /** Light, lens, materials, palette mood — no layout words. */
        style: z.string().min(1).max(400),
        avoid: z.array(z.string().min(1)).max(10).optional(),
      })
      .strict(),
    /** The approved first-fold mock (`kind: mood`) of the chosen concept. */
    mockAssetRef: z.string().regex(/^AST-[0-9]{2,}$/),
  })
  .strict();

export type IntakeArtDirection = z.infer<typeof artDirectionSchema>;

const visualSchema = z
  .object({
    conceptId: z.string(),
    /** RFC-1357/AMD-012: the operator-approved first-fold direction. */
    artDirection: artDirectionSchema,
    rejectedConceptIds: z.array(z.string()).optional(),
    axes: z.looseObject(
      Object.fromEntries(INTAKE_VISUAL_AXES_KEYS.map((key) => [key, z.unknown()])) as Record<
        (typeof INTAKE_VISUAL_AXES_KEYS)[number],
        z.ZodUnknown
      >,
    ),
    palette: z.record(z.string(), z.string()),
    fonts: z
      .array(
        z
          .object({
            family: z.string(),
            role: z.enum(["heading", "body", "accent", "mono"]),
            source: z.string(),
            scripts: z
              .array(z.string().regex(/^[A-Z][a-z]{3}$/))
              .min(1),
          })
          .strict(),
      )
      .min(1),
    moodAssetRefs: z
      .array(z.string().regex(/^AST-[0-9]{2,}$/))
      .optional(),
    rationale: z.string(),
  })
  .strict();

// ---------------------------------------------------------------------------
// provenance
// ---------------------------------------------------------------------------

const provenanceInputSchema = z
  .object({
    path: z.string(),
    sha256: sha256Digest,
    bytes: z.number().int().min(0),
    /** MUST be false (spec P1); present to make clipping auditable. */
    clipped: z.literal(false).optional(),
  })
  .strict();

const provenanceSchema = z
  .object({
    producer: z.string(),
    producerVersion: z.string(),
    runId: z.string(),
    /** SHA-256 of the vendored werkstatt:intake/v2 JSON Schema export. */
    contractSnapshot: sha256Digest,
    /**
     * RFC-1353/AMD-011: digest of the vendored family visitor-question export
     * the producer resolved `visitorQuestionRef` against — absent when the
     * bundle carries no faq block or no family-question origin.
     */
    familyQuestionsSnapshot: sha256Digest.optional(),
    inputs: z.array(provenanceInputSchema).min(1),
    evidenceLedger: sha256Digest,
    models: z.array(
      z
        .object({
          step: z.string(),
          model: z.string(),
          effort: z.enum(["low", "medium", "high", "xhigh", "max", "n/a"]),
        })
        .strict(),
    ),
    quoteCheck: z
      .object({
        result: z.enum(["pass", "fail"]),
        checked: z.number().int().min(0),
        failed: z.literal(0),
      })
      .strict(),
    cost: z
      .object({
        currency: z.literal("USD"),
        total: z.number().min(0),
        reportPath: z.literal("cost-report.json"),
      })
      .strict(),
  })
  .strict();

// ---------------------------------------------------------------------------
// intake-gap.schema.yaml — the two allOf/if-then rules become superRefine.
// ---------------------------------------------------------------------------

export const intakeGapSchema = z
  .object({
    id: z.string().regex(/^GAP-[0-9]{2,}$/),
    /**
     * RFC-1342/AMD-007: what kind of input the gap asks for. `proof` proves a
     * blocked statement; `rights` is permission to publish material;
     * `approval` is client sign-off on wording; `scope-extension` asks
     * whether a known set grows; `operational` blocks nothing publishable
     * (domain, billing, process) — INTAKE-16 forbids the last two kinds
     * from appearing in any blockers/blocks edge.
     */
    kind: z.enum(["proof", "rights", "approval", "scope-extension", "operational"]),
    what: z.string().min(1),
    why: z.string().min(1),
    obtainableBy: z.enum(["client", "studio", "either"]),
    /** Required when obtainableBy is `client` or `either` (spec allOf). */
    itemType: z.enum(["file", "text", "choice", "approval"]).optional(),
    /** Required when itemType is `choice` (spec allOf). */
    choices: z.array(z.string()).optional(),
    clientPrompt: z.string().optional(),
    defaultIfSilent: z.string().min(1),
    /** PBP entity ids whose publication waits on this gap (may be empty). */
    blocks: z.array(z.string()),
    severity: z.enum(["launch-blocking", "post-launch"]).default("post-launch"),
    ledgerRefs: z.array(z.string()).optional(),
    evidenceRefs: z.array(z.string()).optional(),
  })
  .strict()
  .superRefine((gap, ctx) => {
    if ((gap.obtainableBy === "client" || gap.obtainableBy === "either") && !gap.itemType) {
      ctx.addIssue({
        code: "custom",
        message: "itemType is required when obtainableBy is 'client' or 'either'",
        path: ["itemType"],
      });
    }
    if (gap.itemType === "choice" && !gap.choices) {
      ctx.addIssue({
        code: "custom",
        message: "choices is required when itemType is 'choice'",
        path: ["choices"],
      });
    }
  });

// ---------------------------------------------------------------------------
// intake-asset.schema.yaml — the two allOf/if-then rules become superRefine.
// ---------------------------------------------------------------------------

/**
 * RFC-1345/AMD-009: what an image-bearing asset depicts. `represented-product`
 * marks real goods the client represents — MEDIA-01 forbids generated imagery
 * in those slots; `people` keeps model photography separable for rights calls
 * (dp7 AST-14).
 */
const depictsKindSchema = z.enum([
  "represented-product",
  "brand-mark",
  "people",
  "place",
  "atmosphere",
  "illustration",
  "abstract",
]);

const depictsSchema = z
  .object({
    kind: depictsKindSchema,
    /** Any PBP entity id in the bundle — claims included (INTAKE-04). */
    entityRefs: z.array(z.string().min(1)).min(1).optional(),
    label: z.string().min(1).optional(),
  })
  .strict();

/** Normalized [x, y, width, height] crop region inside a document page. */
const regionSchema = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
  z.number().min(0).max(1),
  z.number().min(0).max(1),
]);

/**
 * Asset kinds whose file is itself the content image — `depicts` is required
 * on these. `icon` stays optional (a pictorial icon SHOULD declare depicts;
 * abstract UI glyphs need not); `document`/`video`/`mood`/`logo` are exempt.
 */
const DEPICTS_REQUIRED_KINDS = new Set(["photo", "product-photo", "illustration"]);

export const intakeAssetSchema = z
  .object({
    id: z.string().regex(/^AST-[0-9]{2,}$/),
    kind: z.enum([
      "logo",
      "photo",
      "product-photo",
      "illustration",
      "mood",
      "video",
      "document",
      "icon",
    ]),
    file: z.string().regex(/^assets\/[0-9a-f]{64}\.[a-z0-9]+$/),
    sha256: sha256Digest,
    mediaType: z.string(),
    width: z.number().int().min(1).optional(),
    height: z.number().int().min(1).optional(),
    /** `extracted` ⇒ `derivedFrom` required (RFC-1345). */
    origin: z.enum(["client", "generated", "stock", "studio", "extracted"]),
    rights: z
      .object({
        state: z.enum([
          "cleared",
          "client-supplied",
          "generated",
          "licensed-stock",
          "claimed",
          "unknown",
        ]),
        holder: z.string().optional(),
        /** Mandatory for licensed-stock (spec allOf). */
        licence: z.string().optional(),
        licenceUrl: z.url().optional(),
        evidenceRef: z.string().optional(),
        /**
         * RFC-1345/AMD-009: gap ids blocking this asset's use — mirrors the
         * RFC-1342 claim-side blockers[] swap (replaces v1 `gapRef`).
         */
        blockers: z.array(z.string().regex(/^GAP-[0-9]{2,}$/)).min(1).optional(),
        restrictions: z.array(z.string()).optional(),
      })
      .strict(),
    /** Mandatory for origin `generated` (spec allOf, INTAKE-09). */
    generator: z
      .object({
        model: z.string(),
        promptSha256: sha256Digest,
        conceptId: z.string().optional(),
        generatedAt: z.iso.datetime(),
      })
      .strict()
      .optional(),
    /**
     * RFC-1345: what the asset depicts — required on image-bearing kinds
     * (`photo`, `product-photo`, `illustration`); optional elsewhere.
     */
    depicts: depictsSchema.optional(),
    /**
     * RFC-1345: page imagery the producer wants extracted from this document —
     * `asset.extract` / `sternsystem.register --intake` run the deterministic
     * poppler pipeline for every hinted page. Only legal on `kind: document`.
     */
    mediaHints: z
      .array(
        z
          .object({
            page: z.number().int().min(1),
            region: regionSchema.optional(),
            depicts: depictsSchema,
          })
          .strict(),
      )
      .min(1)
      .optional(),
    /**
     * RFC-1345: provenance of an `extracted` asset — which document asset it
     * came from, the source content hash, and the page/region/method.
     * INTAKE-21 verifies `asset` resolves to a `document` asset whose sha256
     * equals `sourceSha256`; INTAKE-22 pins rights equality with the source.
     */
    derivedFrom: z
      .object({
        asset: z.string().regex(/^AST-[0-9]{2,}$/),
        sourceSha256: sha256Digest,
        page: z.number().int().min(1).optional(),
        region: regionSchema.optional(),
        method: z.enum(["embedded-image", "page-render"]),
      })
      .strict()
      .optional(),
    altText: z.record(z.string(), z.string()).optional(),
    subject: z.string().optional(),
  })
  .strict()
  .superRefine((asset, ctx) => {
    if (asset.origin === "generated") {
      if (!asset.generator) {
        ctx.addIssue({
          code: "custom",
          message: "generator is required when origin is 'generated'",
          path: ["generator"],
        });
      }
      if (asset.rights.state !== "generated") {
        ctx.addIssue({
          code: "custom",
          message: "rights.state must be 'generated' when origin is 'generated'",
          path: ["rights", "state"],
        });
      }
    }
    if (asset.origin === "extracted" && !asset.derivedFrom) {
      ctx.addIssue({
        code: "custom",
        message: "derivedFrom is required when origin is 'extracted'",
        path: ["derivedFrom"],
      });
    }
    if (asset.derivedFrom && asset.origin !== "extracted") {
      ctx.addIssue({
        code: "custom",
        message: "derivedFrom is only allowed when origin is 'extracted'",
        path: ["derivedFrom"],
      });
    }
    if (asset.mediaHints && asset.kind !== "document") {
      ctx.addIssue({
        code: "custom",
        message: "mediaHints is only allowed on kind 'document'",
        path: ["mediaHints"],
      });
    }
    if (DEPICTS_REQUIRED_KINDS.has(asset.kind) && !asset.depicts) {
      ctx.addIssue({
        code: "custom",
        message: `depicts is required on image-bearing kind '${asset.kind}'`,
        path: ["depicts"],
      });
    }
    if (asset.rights.state === "licensed-stock" && !asset.rights.licence) {
      ctx.addIssue({
        code: "custom",
        message: "rights.licence is required when rights.state is 'licensed-stock'",
        path: ["rights", "licence"],
      });
    }
  });

// ---------------------------------------------------------------------------
// intake-slot-brief.schema.yaml — RFC-1346: deferred image fulfilment briefs
// ---------------------------------------------------------------------------

/**
 * RFC-1346/AMD-010: what a post-approval `asset.slot.fulfill` run may fill.
 * `depicts-represented-product` slots carry no prompt — they can only be
 * filled by real media (MEDIA-01); every other role keeps the full prompt
 * the provider receives after the visual-review approval.
 */
const slotBriefRoleSchema = z.enum([
  "atmosphere",
  "illustration",
  "depicts-represented-product",
]);

/**
 * RFC-1357/AMD-012: what a slot's image depicts — the `depicts.kind`
 * vocabulary minus brand-mark/abstract, so slot ↔ section-slot compatibility
 * is a mechanical `subjectKind` vs `imageSlots[].depicts` check (COMP-SLOT-01).
 */
export const intakeSubjectKindSchema = z.enum([
  "atmosphere",
  "illustration",
  "people",
  "place",
  "represented-product",
]);

export const intakeSlotBriefSchema = z
  .object({
    id: z.string().regex(/^SLOT-[0-9]{2,}$/),
    /** A `classification.pageSetIntent[].intent` entry (INTAKE-25). */
    intent: z.string().min(1),
    role: slotBriefRoleSchema,
    /**
     * RFC-1357/AMD-012: where on a page the slot lands. `slotKind` is the
     * section-slot shape (background/feature/portrait/card-image) — it does
     * NOT name a prop (`slotKind: portrait` ≠ `portraitImage`).
     */
    placement: z
      .object({
        surface: z.enum(["first-fold", "section", "card"]),
        slotKind: z.enum(["background", "feature", "portrait", "card-image"]),
      })
      .strict(),
    /** The `depicts.kind` vocabulary entry the fulfilled asset must carry. */
    subjectKind: intakeSubjectKindSchema,
    /**
     * The only carrier of composition intent for the image itself —
     * positioning hints fulfilment translates into photographic language.
     */
    framing: z
      .object({
        subjectPosition: z.enum(["left-third", "center", "right-third"]).optional(),
        copySpace: z.enum(["left", "right", "top", "none"]).optional(),
      })
      .strict()
      .optional(),
    /** Short label rendered on the deterministic register placeholder. */
    label: z.string().min(1),
    /**
     * Full generation prompt — forbidden on `depicts-represented-product`
     * (spec allOf → superRefine): that slot can only be filled by real media.
     */
    prompt: z.string().min(1).optional(),
    constraints: z.array(z.string().min(1)).optional(),
    /** `W:H` aspect hint; consumers default to 3:2. */
    aspectHint: z.string().regex(/^[0-9]+:[0-9]+$/).optional(),
    /**
     * Intake asset ids to use before generating (source-first fulfilment —
     * e.g. an `extracted` asset from RFC-1345).
     */
    preferredSources: z.array(z.string().regex(/^AST-[0-9]{2,}$/)).optional(),
    /** The open gap that must close before real media exists. */
    awaitingGap: z.string().regex(/^GAP-[0-9]{2,}$/).optional(),
    evidenceRefs: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .superRefine((brief, ctx) => {
    // RFC-1357/AMD-012: subjectKind ⇔ role binding — `represented-product`
    // is permitted only on (and required of) `depicts-represented-product`
    // briefs, so COMP-SLOT-01 can trust the subjectKind alone.
    if (brief.subjectKind === "represented-product" && brief.role !== "depicts-represented-product") {
      ctx.addIssue({
        code: "custom",
        message:
          "subjectKind 'represented-product' is permitted only on role 'depicts-represented-product'",
        path: ["subjectKind"],
      });
    }
    if (brief.role === "depicts-represented-product" && brief.subjectKind !== "represented-product") {
      ctx.addIssue({
        code: "custom",
        message:
          "role 'depicts-represented-product' requires subjectKind 'represented-product'",
        path: ["subjectKind"],
      });
    }
    if (brief.role !== "depicts-represented-product") return;
    if (brief.prompt !== undefined) {
      ctx.addIssue({
        code: "custom",
        message:
          "prompt is forbidden when role is 'depicts-represented-product' — that slot fills only from real media",
        path: ["prompt"],
      });
    }
    if ((brief.preferredSources?.length ?? 0) === 0 && !brief.awaitingGap) {
      ctx.addIssue({
        code: "custom",
        message:
          "depicts-represented-product briefs must name preferredSources (>=1) or awaitingGap",
        path: ["preferredSources"],
      });
    }
  });

// ---------------------------------------------------------------------------
// intake-faq.schema.yaml — RFC-1353/AMD-011: the client FAQ block
// ---------------------------------------------------------------------------

/** Per-locale text keyed by the BCP 47 tags of `classification.locales`. */
const localeText = z.record(bcp47Tag, z.string().min(1));

export const intakeFaqTopicSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    label: localeText,
    /** A `classification.pageSetIntent[].intent` or the literal `faq` (INTAKE-26). */
    placement: z.string().min(1),
    order: z.number().int(),
  })
  .strict();

export const intakeFaqEntrySchema = z
  .object({
    id: z.string().regex(/^FAQ-[0-9]{2,}$/),
    topic: z.string(),
    order: z.number().int(),
    slug: z.string().regex(/^[a-z][a-z0-9-]*$/).optional(),
    question: localeText,
    /** Present only on `answered` entries (INTAKE-02). */
    answer: localeText.optional(),
    /** Confirmable draft shown to the client while `awaiting-client`. */
    proposedAnswer: localeText.optional(),
    status: z.enum(["answered", "awaiting-client", "internal"]),
    origin: z.enum([
      "client-material",
      "client-answer",
      "public-assertion",
      "family-question",
      "archetype",
      "studio",
    ]),
    evidenceRefs: z.array(sourceRef).optional(),
    entityRefs: z.array(z.string().min(1)).optional(),
    verbatim: z.array(verbatimSchema).optional(),
    questionnaireRef: z.string().regex(/^Q-[0-9]{2,}$/).optional(),
    /** Required on `family-question` origin (INTAKE-02) — id in the vendored export. */
    visitorQuestionRef: z.string().regex(/^[a-z][a-z0-9-]*$/).optional(),
    blockers: z.array(gapId).min(1).optional(),
    ceiling: z.enum(["draft", "preview"]).optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.status === "answered" && !entry.answer) {
      ctx.addIssue({
        code: "custom",
        message: "answer is required when status is 'answered'",
        path: ["answer"],
      });
    }
    if (entry.status === "awaiting-client" && entry.answer) {
      ctx.addIssue({
        code: "custom",
        message: "answer is forbidden while status is 'awaiting-client' — use proposedAnswer",
        path: ["answer"],
      });
    }
    if (entry.status === "internal" && entry.ceiling) {
      ctx.addIssue({
        code: "custom",
        message: "ceiling is forbidden on internal entries — internal is never publishable",
        path: ["ceiling"],
      });
    }
    if (entry.origin === "family-question" && !entry.visitorQuestionRef) {
      ctx.addIssue({
        code: "custom",
        message: "visitorQuestionRef is required when origin is 'family-question'",
        path: ["visitorQuestionRef"],
      });
    }
  });

/**
 * Publication tier of a seeded FAQ entry (RFC-1353): public = answered with no
 * blockers; preview = answered at `ceiling: preview` (rights/approval blockers
 * only, INTAKE-19); everything else renders as a flagged draft.
 */
export function faqEntryTier(entry: {
  status: string;
  ceiling?: string;
  blockers?: readonly string[];
}): "public" | "preview" | "draft" {
  if (entry.status !== "answered") return "draft";
  if ((entry.blockers?.length ?? 0) > 0) {
    return entry.ceiling === "preview" ? "preview" : "draft";
  }
  return "public";
}

export type IntakeFaqTopic = z.infer<typeof intakeFaqTopicSchema>;
export type IntakeFaqEntry = z.infer<typeof intakeFaqEntrySchema>;

// ---------------------------------------------------------------------------
// werkstatt-intake.schema.yaml — the envelope
// ---------------------------------------------------------------------------

export const intakeEnvelopeSchema = z
  .object({
    schema: z.literal(INTAKE_SCHEMA_ID),
    intakeId: z
      .string()
      // Canonical intakeId format — mirrored in ontology/schemas/biome.ts
      // (intakeBiomeProvenanceSchema); update both on format change.
      .regex(/^int_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
    systemId: z.string().regex(/^[a-z][a-z0-9-]{1,48}$/),
    producedAt: z.iso.datetime(),
    classification: classificationSchema,
    pbp: z.array(intakePbpEntitySchema).min(1),
    annotations: z.record(z.string(), annotationSchema),
    gaps: z.array(intakeGapSchema),
    operatorDecisions: z.array(operatorDecisionSchema),
    voice: voiceSchema,
    visual: visualSchema,
    assets: z.array(intakeAssetSchema),
    /**
     * RFC-1346/AMD-010: image slots the pipeline leaves unfilled — register
     * renders deterministic placeholders; `asset.slot.fulfill` fills them
     * after the recorded visual-review approval.
     */
    slotBriefs: z.array(intakeSlotBriefSchema).optional(),
    /**
     * RFC-1353/AMD-011: client FAQ material — evidence-bound, locale-aware
     * topics and entries the register seeds into `src/content/faq/`.
     */
    faq: z
      .object({
        topics: z.array(intakeFaqTopicSchema).min(1),
        entries: z.array(intakeFaqEntrySchema),
      })
      .strict()
      .optional(),
    provenance: provenanceSchema,
  })
  .strict()
  .superRefine((env, ctx) => {
    // RFC-1342/AMD-007: a non-published, non-internal entity MUST declare its
    // blockers — the contract-level form of v1's INTAKE-06 (schema defect,
    // reported as INTAKE-02, not a semantic violation).
    for (const entity of env.pbp) {
      if (entity.status !== "draft") continue;
      const annotation = env.annotations[entity.id];
      if (annotation?.internal === true) continue;
      if (!annotation?.blockers || annotation.blockers.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: `draft entity '${entity.id}' has no annotation with internal: true or a non-empty blockers[]`,
          path: ["annotations", entity.id, "blockers"],
        });
      }
    }
  });

export type IntakeEnvelope = z.infer<typeof intakeEnvelopeSchema>;
export type IntakeGap = z.infer<typeof intakeGapSchema>;
export type IntakeAsset = z.infer<typeof intakeAssetSchema>;
export type IntakeSlotBrief = z.infer<typeof intakeSlotBriefSchema>;

const INTAKE_EXPORT_ID =
  "https://werkstatt.local/specs/onboarding/v0.1.0/werkstatt-intake.schema.yaml";

/** JSON Schema (draft 2020-12) fragment for one allow-listed PBP entity type. */
export type IntakePbpEntityJsonSchemas = Partial<
  Record<(typeof INTAKE_PBP_SCHEMA_ALLOWLIST)[number], Record<string, unknown>>
>;

/** `$defs` key for a PBP schema id: `pbp/legal-identity@1` → `pbp-legal-identity-1`. */
export function intakePbpDefKey(schemaId: string): string {
  return schemaId.replace("/", "-").replace("@", "-");
}

/**
 * Render the JSON Schema (draft 2020-12) producers vendor byte-exact — the
 * RFC-0336 `#` header is added by the owning command, not here.
 *
 * RFC-1301: when `pbpEntitySchemas` is supplied (rendered by the engine from
 * the canonical @warpgogol/pbp Zod schemas — this package cannot import pbp),
 * each fragment lands under `$defs/<intakePbpDefKey(id)>` and `pbp.items`
 * dispatches to it by `schema` const, so the single exported file validates
 * the full entity shapes and one sha256 (provenance.contractSnapshot) covers
 * envelope and entities alike.
 */
export function renderIntakeSchemaExport(
  options: { pbpEntitySchemas?: IntakePbpEntityJsonSchemas } = {},
): string {
  const jsonSchema = z.toJSONSchema(intakeEnvelopeSchema, {
    target: "draft-2020-12",
    unrepresentable: "any",
  }) as Record<string, unknown>;
  const entities = options.pbpEntitySchemas;
  if (entities === undefined) {
    return YAML.stringify({
      $id: INTAKE_EXPORT_ID,
      title: "Werkstatt Intake v2 envelope",
      ...jsonSchema,
    });
  }
  const $defs: Record<string, unknown> = {};
  const dispatch: Record<string, unknown>[] = [];
  for (const id of INTAKE_PBP_SCHEMA_ALLOWLIST) {
    const fragment = entities[id];
    if (fragment === undefined) {
      throw new Error(`renderIntakeSchemaExport: missing JSON Schema for allow-listed ${id}`);
    }
    $defs[intakePbpDefKey(id)] = fragment;
    dispatch.push({
      if: { properties: { schema: { const: id } }, required: ["schema"] },
      then: { $ref: `#/$defs/${intakePbpDefKey(id)}` },
    });
  }
  const properties = jsonSchema["properties"] as Record<string, Record<string, unknown>>;
  const pbp = properties["pbp"] as { items: Record<string, unknown> };
  pbp.items = { ...pbp.items, allOf: dispatch };
  return YAML.stringify({
    $id: INTAKE_EXPORT_ID,
    title: "Werkstatt Intake v2 envelope",
    ...jsonSchema,
    $defs,
  });
}
