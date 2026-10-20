/*
<MODULE_CONTRACT>

<purpose>
RFC-1317: onboardingDecisionLedgerSchema — the Zod mirror of
docs/specs/werkstatt-onboarding/schemas/onboarding-decision.schema.yaml.
The onboarding decision ledger is the single decision window of one
onboarding (D14): append-only OD-NN entries over a closed topic set,
written by onboarding.decision.record into
missions/[missionId]/onboarding.decisions.yaml and checked by
onboarding.decision.validate (ONDEC-01…07; ONDEC-08…11 on rulesVersion-2
ledgers per RFC-1343/AMD-008).
</purpose>
<non-goals>
  <item>Do not encode ONDEC discipline rules here — schema mirrors the vendored contract only; topic/status coupling is enforced by the validator.</item>
  <item>Do not add fields beyond the spec schema — strict objects mirror additionalProperties:false (DNA-19); divergence is a spec amendment, never a silent edit.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>Field-for-field mirror of onboarding-decision.schema.yaml — the spec file is normative.</item>
  <item>capabilityGap reuses capabilityGapSchema (DNA-103 single-sourcing) — the vendored schema $refs it identically.</item>
  <item>recommendation is a required first-class field; options carry label+consequence only.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1346/AMD-010: ONBOARDING_DECISION_TOPICS gains visual-review — the answered Approve gate for asset.slot.fulfill.</item>
  <item>RFC-1343/AMD-008: option tier enum, entry rulingRefs/recommendedOption/overrides (closed reason enum, evidence min 1), ledger rulesVersion (absent = 1) — additive, v1 ledgers still parse.</item>
  <item>RFC-1317: created — ONBOARDING_DECISION_SCHEMA_ID, topic/resolutionPath/status tuples, entry + ledger schemas, inferred types.</item>
  <item>RFC-1317: step 1 — onboarding-decision Zod contract + parity test</item>
  <item>RFC-1317: step 5: docs sync + Compass header repair — AGENTS.md onboarding composer contract, technology.xml/knowledge-graph.xml nodes, app-onboarding-guide commands, regenerated command/ecosystem manifests, /MODULE_CONTRACT closers + KD trims on RFC-1317 files</item>
  <item>RFC-1336: answeredBy/delegatedBy/delegationId provenance fields (strict parity with the spec's if/then) — agent:<id> answers require delegation provenance.</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

import { capabilityGapSchema } from "./capability-gap.ts";

export const ONBOARDING_DECISION_SCHEMA_ID = "werkstatt:onboarding-decisions/v1";

/** Closed topic set — everything outside it is logged, never asked (D14). */
export const ONBOARDING_DECISION_TOPICS = [
  "capability-gap",
  "family-confirmation",
  "biome-confirmation",
  "page-set-deviation",
  "contested-claim-publication",
  "asset-rights-risk",
  "locale-launch",
  "hard-stop",
  /**
   * RFC-1346: D14's dev-preview layout review made explicit — an answered
   * `Approve` gates `asset.slot.fulfill` (post-approval image fulfilment).
   */
  "visual-review",
  "auto-resolved-log",
] as const;

/** The nine operator-facing topics — `auto-resolved-log` is the tenth, log-only. */
export const ONBOARDING_OPERATOR_TOPICS = ONBOARDING_DECISION_TOPICS.filter(
  (t) => t !== "auto-resolved-log",
);

export const ONBOARDING_RESOLUTION_PATHS = [
  "codebase",
  "convention",
  "profile",
  "policy",
  "evidence",
  "none",
] as const;

export const ONBOARDING_DECISION_STATUSES = [
  "open",
  "answered",
  "auto-resolved",
  "deferred",
] as const;

const odIdSchema = z.string().regex(/^OD-[0-9]{2,}$/);

const onboardingDecisionOptionSchema = z
  .object({
    label: z.string(),
    consequence: z.string(),
    /**
     * RFC-1343/AMD-008: highest publication tier this option lets the
     * referenced entities reach. Absent reads as `omit` (ONDEC-09).
     */
    tier: z.enum(["omit", "draft", "preview", "public"]).optional(),
  })
  .strict();

export const onboardingDecisionEntrySchema = z
  .object({
    id: odIdSchema,
    /** Closed set of what reaches the operator (D14). */
    topic: z.enum(ONBOARDING_DECISION_TOPICS),
    question: z.string(),
    options: z.array(onboardingDecisionOptionSchema).optional(),
    /** The composer's recommended answer, first-class (RFC-1250 style). */
    recommendation: z.string(),
    resolutionPath: z.enum(ONBOARDING_RESOLUTION_PATHS),
    /** Intake ids, gap ids, capability-gap ids, PBP entity ids. */
    refs: z.array(z.string()).optional(),
    /**
     * RFC-1343/AMD-008: intake operator rulings (OPD-NN, DEF-NN) this
     * entry's refs touch — ONDEC-08 requires citing a ruling whose
     * appliesTo intersects refs.
     */
    rulingRefs: z
      .array(z.string().regex(/^(OPD|DEF)-[0-9]{2,}$/))
      .optional(),
    /**
     * RFC-1343/AMD-008: machine-checkable recommendation — must equal one
     * options[].label when options exist (ONDEC-11). The free-text
     * `recommendation` stays the human-readable form.
     */
    recommendedOption: z.string().optional(),
    /**
     * RFC-1343/AMD-008: declared contradiction of a cited ruling —
     * mandatory when the recommended option's tier is below the ruling's
     * grantsTier (ONDEC-09); evidence ids make the override auditable.
     */
    overrides: z
      .array(
        z
          .object({
            ruling: z.string().regex(/^(OPD|DEF)-[0-9]{2,}$/),
            reason: z.enum([
              "ruling-superseded-by-new-evidence",
              "ruling-out-of-scope",
              "hard-stop",
            ]),
            /** Evidence-source / gap / journal ids backing the override. */
            evidence: z.array(z.string()).min(1),
          })
          .strict(),
      )
      .optional(),
    /** Inline capability-gap record when topic is capability-gap. */
    capabilityGap: capabilityGapSchema.optional(),
    status: z.enum(ONBOARDING_DECISION_STATUSES),
    answer: z.string().optional(),
    answeredAt: z.iso.datetime().optional(),
    /**
     * RFC-1336: who bound the answer — human:<handle> directly, or
     * agent:<id> under an active onboarding.decision delegation.
     */
    answeredBy: z
      .string()
      .regex(/^(human|agent):[a-z0-9-]+$/)
      .optional(),
    /** RFC-1336: the granting human on delegated answers. */
    delegatedBy: z
      .string()
      .regex(/^human:[a-z0-9-]+$/)
      .optional(),
    /** RFC-1336: the delegation id backing an agent answer. */
    delegationId: z
      .string()
      .regex(/^del-[0-9]{4,}$/)
      .optional(),
  })
  .strict()
  .refine(
    (e) =>
      !e.answeredBy?.startsWith("agent:") ||
      (e.delegatedBy !== undefined && e.delegationId !== undefined),
    {
      message:
        "agent:<id> answeredBy requires delegatedBy + delegationId provenance (RFC-1336) — an unsigned agent attestation is not a decision",
    },
  );

export const onboardingDecisionLedgerSchema = z
  .object({
    schema: z.literal(ONBOARDING_DECISION_SCHEMA_ID),
    systemId: z.string(),
    missionId: z.string(),
    intakeId: z.string(),
    createdAt: z.iso.datetime(),
    /**
     * RFC-1343/AMD-008: ONDEC rule-set the ledger is audited under.
     * Absent = 1 (pre-RFC-1343 ledgers, ONDEC-01…07 only); 2 enables
     * ONDEC-08…11. Stamped by onboarding.decision.record on creation.
     */
    rulesVersion: z.literal(2).optional(),
    items: z.array(onboardingDecisionEntrySchema),
  })
  .strict();

export type OnboardingDecisionTopic = (typeof ONBOARDING_DECISION_TOPICS)[number];
export type OnboardingResolutionPath = (typeof ONBOARDING_RESOLUTION_PATHS)[number];
export type OnboardingDecisionStatus = (typeof ONBOARDING_DECISION_STATUSES)[number];
export type OnboardingDecisionEntry = z.infer<typeof onboardingDecisionEntrySchema>;
export type OnboardingDecisionLedger = z.infer<typeof onboardingDecisionLedgerSchema>;
