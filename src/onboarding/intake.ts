/*
<MODULE_CONTRACT>

<purpose>Zod model of the werkstatt:intake/v1 hand-over envelope (RFC-1281,
spec werkstatt-onboarding ON-01 / INTAKE-CONTRACT, AMD-001 §1) — the single
producer → Werkstatt contract. Owns every envelope field of the three
normative v0.1.0 spec schemas; pbp[] entities are checked at envelope level
only (schema allow-list, id, type, status). Also renders the JSON Schema
export that producers vendor byte-exact
(intake.schema.generated.yaml, owner command onboarding.intake.schema.export).</purpose>
<non-goals>
  <item>Do not redeclare PBP entity shapes (DNA-103) — full entity validation runs in @warpgogol/werkstatt-engine via pbpSchemaById (INTAKE-03); this package cannot import @warpgogol/pbp without a dependency cycle.</item>
  <item>Do not touch the filesystem or run bundle-level checks — INTAKE-01…11 live in @warpgogol/werkstatt-engine.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>pbp[] entities are checked at envelope level only</item>
  <item>Entity JSON Schemas are injected by the engine (RFC-1301) as $defs of the same export</item>
  <item>Zod is the source of truth (spec D2)</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1328/AMD-005: statementByLocale + localeNeutral on the envelope entity (INTAKE-13); envelope-level, pbp/*@1 schemas untouched.</item>
  <item>RFC-1281: created — envelope Zod model of werkstatt:intake/v1 (envelope, gap, asset) + renderIntakeSchemaExport().</item>
  <item>RFC-1281: intake contract and onboarding.intake.validate</item>
  <item>RFC-1301: export PBP entity JSON Schemas in werkstatt:intake/v1 (RFC-1301)</item>
  <item>RFC-1298: REVIEW-CODE-2026-10-16-01 findings — kebab flag guards, safeParse, reads declaration, family-append ordering, FONTS-SCRIPT-02 unverifiable-stack warning</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";
import YAML from "yaml";

export const INTAKE_SCHEMA_ID = "werkstatt:intake/v1" as const;

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

const intakePbpEntitySchema = z.looseObject({
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

const annotationSchema = z
  .object({
    verbatim: z.array(verbatimSchema).optional(),
    /** Gap whose closure publishes this draft entity (INTAKE-06). */
    gapRef: z
      .string()
      .regex(/^GAP-[0-9]{2,}$/)
      .optional(),
    /** Composer context only — never publishable (D10 gate). */
    internal: z.boolean().optional(),
    /** Originating evidence-ledger record id (e.g. CLM-023). */
    ledgerRef: z.string().optional(),
  })
  .strict();

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
  })
  .strict();

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

const visualSchema = z
  .object({
    conceptId: z.string(),
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
    /** SHA-256 of the vendored werkstatt:intake/v1 JSON Schema export. */
    contractSnapshot: sha256Digest,
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
    origin: z.enum(["client", "generated", "stock", "studio"]),
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
        gapRef: z
          .string()
          .regex(/^GAP-[0-9]{2,}$/)
          .optional(),
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
    if (asset.rights.state === "licensed-stock" && !asset.rights.licence) {
      ctx.addIssue({
        code: "custom",
        message: "rights.licence is required when rights.state is 'licensed-stock'",
        path: ["rights", "licence"],
      });
    }
  });

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
    provenance: provenanceSchema,
  })
  .strict();

export type IntakeEnvelope = z.infer<typeof intakeEnvelopeSchema>;
export type IntakeGap = z.infer<typeof intakeGapSchema>;
export type IntakeAsset = z.infer<typeof intakeAssetSchema>;

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
      title: "Werkstatt Intake v1 envelope",
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
    title: "Werkstatt Intake v1 envelope",
    ...jsonSchema,
    $defs,
  });
}
