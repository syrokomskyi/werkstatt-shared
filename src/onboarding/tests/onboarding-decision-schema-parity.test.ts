/*
<MODULE_CONTRACT>
<purpose>RFC-1317: prove onboardingDecisionLedgerSchema (Zod, source of truth)
and the normative werkstatt-onboarding v0.1.0 onboarding-decision.schema.yaml
produce identical accept/reject verdicts on the fixture set. The spec schema
is loaded from docs/specs/werkstatt-onboarding/schemas/ and compiled with Ajv
(draft 2020-12 + formats); capability-gap.schema.yaml is registered first so
the entry-level $ref resolves, mirroring intake-schema-parity.test.ts.</purpose>
<non-goals>
  <item>Do not exercise ONDEC-01…07 discipline rules — those are validator-side (werkstatt-site), not schema-level.</item>
  <item>Do not mutate the spec schemas — they are the normative reference.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1357/AMD-012: +1 fixture — art-direction-deviation topic pins the closed enum on both schema sides.</item>
  <item>RFC-1343/AMD-008: +7 fixtures — rulesVersion literal, rulingRefs pattern, option tier enum, override reason enum + evidence min-1.</item>
  <item>RFC-1317: review r1 — negative date-time fixtures (bad-createdAt, bad-answeredAt).</item>
  <history>RFC-1317</history>
</CHANGE_SUMMARY>
*/

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";
import { describe, expect, it } from "vitest";

import { onboardingDecisionLedgerSchema } from "../onboarding-decision.ts";

const SPECS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../docs/specs/werkstatt-onboarding/schemas",
);

function loadSpec(name: string): Record<string, unknown> {
  return YAML.parse(readFileSync(resolve(SPECS_DIR, name), "utf8"));
}

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
// The decision schema $refs "capability-gap.schema.yaml" — register it under
// its own $id before compiling, same as the intake parity test.
ajv.addSchema(loadSpec("capability-gap.schema.yaml"));
const specValidate = ajv.compile(loadSpec("onboarding-decision.schema.yaml"));

const VALID_GAP = {
  id: "CAPGAP-001",
  systemId: "dp7",
  kind: "new-family",
  need: {
    statement: "No site family matches the intake classification",
    evidenceRefs: ["evidence-source/src-01"],
  },
  catalogEvidence: {
    capabilityBriefSha256: "sha256:" + "0".repeat(64),
    familyScore: 0.5,
    candidates: [
      { ref: "family-a", whyInsufficient: "unmatched signals" },
    ],
  },
  proposal: { functionalName: "donation-kindergarten", track: "data" },
  interim: "compose with the closest family's required archetypes",
};

function openEntry(): Record<string, unknown> {
  return {
    id: "OD-01",
    topic: "family-confirmation",
    question: "Accept the detected family?",
    options: [
      { label: "A — accept", consequence: "recipe applies as detected" },
      { label: "B — override", consequence: "compose with another family" },
    ],
    recommendation: "A",
    resolutionPath: "none",
    refs: ["evidence-source/src-01"],
    status: "open",
  };
}

function baseLedger(): Record<string, unknown> {
  return {
    schema: "werkstatt:onboarding-decisions/v1",
    systemId: "dp7",
    missionId: "dp7-m000001",
    intakeId: "int_019a4f2c-7a01-7f30-8c1e-9f2e4a6b8d01",
    createdAt: "2026-10-17T12:00:00Z",
    items: [openEntry()],
  };
}

interface ParityFixture {
  name: string;
  build: () => Record<string, unknown>;
}

const FIXTURES: ParityFixture[] = [
  { name: "valid-ledger", build: baseLedger },
  {
    name: "wrong-schema-const",
    build: () => {
      const l = baseLedger();
      l.schema = "werkstatt:onboarding-decisions/v2";
      return l;
    },
  },
  {
    name: "bad-od-id",
    build: () => {
      const l = baseLedger();
      (l.items as Record<string, unknown>[])[0].id = "OD-1";
      return l;
    },
  },
  {
    name: "missing-recommendation",
    build: () => {
      const l = baseLedger();
      delete (l.items as Record<string, unknown>[])[0].recommendation;
      return l;
    },
  },
  {
    name: "bad-topic",
    build: () => {
      const l = baseLedger();
      (l.items as Record<string, unknown>[])[0].topic = "pricing-question";
      return l;
    },
  },
  {
    name: "bad-resolutionPath",
    build: () => {
      const l = baseLedger();
      (l.items as Record<string, unknown>[])[0].resolutionPath = "operator";
      return l;
    },
  },
  {
    name: "entry-with-unknown-key",
    build: () => {
      const l = baseLedger();
      (l.items as Record<string, unknown>[])[0].internal = "x";
      return l;
    },
  },
  {
    name: "ledger-with-unknown-top-level-key",
    build: () => {
      const l = baseLedger();
      l.meta = { note: "x" };
      return l;
    },
  },
  {
    name: "valid-capability-gap-entry",
    build: () => {
      const l = baseLedger();
      const entry = openEntry();
      entry.topic = "capability-gap";
      entry.capabilityGap = VALID_GAP;
      l.items = [entry];
      return l;
    },
  },
  {
    name: "invalid-capabilityGap-payload",
    build: () => {
      const l = baseLedger();
      const entry = openEntry();
      entry.topic = "capability-gap";
      entry.capabilityGap = { id: "not-a-capgap" };
      l.items = [entry];
      return l;
    },
  },
  {
    name: "option-with-recommended-key",
    build: () => {
      const l = baseLedger();
      const entry = l.items as Record<string, unknown>[];
      (
        (entry[0].options as Record<string, unknown>[])[0] as Record<
          string,
          unknown
        >
      ).recommended = true;
      return l;
    },
  },
  {
    name: "bad-createdAt-local-date",
    build: () => {
      const l = baseLedger();
      l.createdAt = "17.10.2026";
      return l;
    },
  },
  {
    name: "bad-answeredAt-no-offset",
    build: () => {
      const l = baseLedger();
      const entry = l.items as Record<string, unknown>[];
      entry[0].status = "answered";
      entry[0].resolutionPath = "operator";
      entry[0].answer = "confirmed by operator";
      entry[0].answeredAt = "2026-10-17T12:05:00";
      return l;
    },
  },
  // ─── RFC-1343/AMD-008: ruling refs, tiers, overrides, rulesVersion ───────
  {
    name: "valid-rulesVersion2-ledger",
    build: () => {
      const l = baseLedger();
      l.rulesVersion = 2;
      const entry = (l.items as Record<string, unknown>[])[0];
      entry.rulingRefs = ["OPD-08", "DEF-03"];
      entry.recommendedOption = "A — accept";
      (entry.options as Record<string, unknown>[])[0].tier = "preview";
      entry.overrides = [
        {
          ruling: "OPD-08",
          reason: "ruling-superseded-by-new-evidence",
          evidence: ["evidence-source/src-77"],
        },
      ];
      return l;
    },
  },
  {
    name: "rulesVersion-1-literal-rejected",
    build: () => {
      const l = baseLedger();
      l.rulesVersion = 1; // only the literal 2 is legal — 1 is the absent field
      return l;
    },
  },
  {
    name: "bad-rulingRef-pattern",
    build: () => {
      const l = baseLedger();
      (l.items as Record<string, unknown>[])[0].rulingRefs = ["XX-01"];
      return l;
    },
  },
  {
    name: "option-bad-tier",
    build: () => {
      const l = baseLedger();
      const entry = (l.items as Record<string, unknown>[])[0];
      (entry.options as Record<string, unknown>[])[0].tier = "staging";
      return l;
    },
  },
  {
    name: "override-bad-reason",
    build: () => {
      const l = baseLedger();
      (l.items as Record<string, unknown>[])[0].overrides = [
        { ruling: "OPD-08", reason: "taste", evidence: ["src-1"] },
      ];
      return l;
    },
  },
  {
    name: "override-empty-evidence",
    build: () => {
      const l = baseLedger();
      (l.items as Record<string, unknown>[])[0].overrides = [
        { ruling: "OPD-08", reason: "hard-stop", evidence: [] },
      ];
      return l;
    },
  },
  {
    name: "override-missing-evidence",
    build: () => {
      const l = baseLedger();
      (l.items as Record<string, unknown>[])[0].overrides = [
        { ruling: "OPD-08", reason: "ruling-out-of-scope" },
      ];
      return l;
    },
  },
  // ─── RFC-1357/AMD-012: the art-direction-deviation topic (enum drift pin)
  {
    name: "valid-art-direction-deviation-entry",
    build: () => {
      const l = baseLedger();
      const entry = openEntry();
      entry.topic = "art-direction-deviation";
      entry.refs = ["artDirection.firstFold.surface"];
      entry.status = "answered";
      entry.resolutionPath = "evidence";
      entry.answer = "Approved — dark hero despite the light direction, see evidence.";
      entry.answeredAt = "2026-10-17T12:05:00Z";
      l.items = [entry];
      return l;
    },
  },
];

describe("onboarding decision ledger — Zod/spec-schema parity (RFC-1317)", () => {
  for (const fixture of FIXTURES) {
    it(`fixture ${fixture.name}: identical verdict`, () => {
      const candidate = fixture.build();
      const specVerdict = Boolean(specValidate(candidate));
      const zodVerdict = onboardingDecisionLedgerSchema.safeParse(candidate).success;
      expect(
        zodVerdict,
        `spec=${specVerdict} zod=${zodVerdict} specErrors=${JSON.stringify(specValidate.errors)}`,
      ).toBe(specVerdict);
    });
  }
});
