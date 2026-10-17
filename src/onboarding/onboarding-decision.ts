/*
<MODULE_CONTRACT>

<purpose>
RFC-1317: onboardingDecisionLedgerSchema — the Zod mirror of
docs/specs/werkstatt-onboarding/schemas/onboarding-decision.schema.yaml.
The onboarding decision ledger is the single decision window of one
onboarding (D14): append-only OD-NN entries over a closed topic set,
written by onboarding.decision.record into
missions/[missionId]/onboarding.decisions.yaml and checked by
onboarding.decision.validate (ONDEC-01…07).
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
  <item>RFC-1317: created — ONBOARDING_DECISION_SCHEMA_ID, topic/resolutionPath/status tuples, entry + ledger schemas, inferred types.</item>
  <item>RFC-1317: step 1 — onboarding-decision Zod contract + parity test</item>
  <item>RFC-1317: step 5: docs sync + Compass header repair — AGENTS.md onboarding composer contract, technology.xml/knowledge-graph.xml nodes, app-onboarding-guide commands, regenerated command/ecosystem manifests, /MODULE_CONTRACT closers + KD trims on RFC-1317 files</item>
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
  "auto-resolved-log",
] as const;

/** The eight operator-facing topics — `auto-resolved-log` is the ninth, log-only. */
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
    /** Inline capability-gap record when topic is capability-gap. */
    capabilityGap: capabilityGapSchema.optional(),
    status: z.enum(ONBOARDING_DECISION_STATUSES),
    answer: z.string().optional(),
    answeredAt: z.iso.datetime().optional(),
  })
  .strict();

export const onboardingDecisionLedgerSchema = z
  .object({
    schema: z.literal(ONBOARDING_DECISION_SCHEMA_ID),
    systemId: z.string(),
    missionId: z.string(),
    intakeId: z.string(),
    createdAt: z.iso.datetime(),
    items: z.array(onboardingDecisionEntrySchema),
  })
  .strict();

export type OnboardingDecisionTopic = (typeof ONBOARDING_DECISION_TOPICS)[number];
export type OnboardingResolutionPath = (typeof ONBOARDING_RESOLUTION_PATHS)[number];
export type OnboardingDecisionStatus = (typeof ONBOARDING_DECISION_STATUSES)[number];
export type OnboardingDecisionEntry = z.infer<typeof onboardingDecisionEntrySchema>;
export type OnboardingDecisionLedger = z.infer<typeof onboardingDecisionLedgerSchema>;
