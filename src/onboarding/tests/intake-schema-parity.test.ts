/*
<MODULE_CONTRACT>
<purpose>RFC-1281 AC-7: prove intakeEnvelopeSchema (Zod, source of truth) and the
normative werkstatt-onboarding v0.1.0 JSON Schemas produce identical
accept/reject verdicts on the fixture parity set. Spec schemas are loaded
from docs/specs/werkstatt-onboarding/schemas/ and compiled with Ajv
(draft 2020-12 + formats), mirroring how a producer's vendored copy behaves.</purpose>
<non-goals>
  <item>Do not exercise bundle-level INTAKE-01…20 rules — those are engine-side.</item>
  <item>Do not mutate the spec schemas — they are the normative reference.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1357/AMD-012: baseEnvelope carries the required visual.artDirection + SLOT-01 brief + mood mock — the positive fixture asserts true parity again; +2 fixtures (artDirection-missing, subjectKind⇔role zodOnly).</item>
  <item>RFC-1346/AMD-010: registered intake-slot-brief.schema.yaml with Ajv — the envelope now cross-refs slot briefs.</item>
  <item>RFC-1342/AMD-007: parity set migrated to v2 — wrong-schema-const targets the retired v1 major; new fixtures cover gap.kind, decision effect/grantsTier conditionals, empty blockers (the draft⇒blockers correlation is Zod-only — the vendored schema cannot key annotations to pbp ids, per AMD-007).</item>
  <item>ADR-0114: review fixes: runtime-parity navIds, naming-bound ledger cover, supported-locale legal loop, scaffold-keyed LEGAL-JUR-02, spec schema parity</item>
  <history>RFC-1281</history>
</CHANGE_SUMMARY>
*/

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";
import { describe, expect, it } from "vitest";

import { intakeEnvelopeSchema } from "../intake.ts";

const SPECS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../docs/specs/werkstatt-onboarding/schemas",
);

function loadSpec(name: string): Record<string, unknown> {
  return YAML.parse(readFileSync(resolve(SPECS_DIR, name), "utf8"));
}

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
// Cross-file $refs resolve to each file's own $id — register every sibling
// schema in the specs directory before compiling the envelope, so newly
// vendored fragment schemas never need a manual registration edit here.
for (const file of readdirSync(SPECS_DIR)) {
  if (file !== "werkstatt-intake.schema.yaml" && file.endsWith(".schema.yaml")) {
    ajv.addSchema(loadSpec(file));
  }
}
const specValidate = ajv.compile(loadSpec("werkstatt-intake.schema.yaml"));

const SHA = "sha256:" + "a".repeat(64);

function baseEnvelope(): Record<string, unknown> {
  return {
    schema: "werkstatt:intake/v2",
    intakeId: "int_019a4f2c-7a01-7f30-8c1e-9f2e4a6b8d01",
    systemId: "dp7",
    producedAt: "2026-10-15T10:00:00Z",
    classification: {
      locales: [
        {
          tag: "ru",
          role: "primary",
          sourceLanguageBy: "client",
          reviewer: "studio",
        },
      ],
      jurisdiction: "DE",
      conversionModel: "inquiry",
      profile: "standard",
      pageSetIntent: [
        { intent: "home", evidenceRefs: ["evidence-source/src-01"] },
      ],
    },
    pbp: [
      {
        schema: "pbp/business@1",
        id: "business/dp7",
        type: "business",
        status: "published",
        name: "dp7 Installations GmbH",
      },
    ],
    annotations: {},
    gaps: [
      {
        id: "GAP-04",
        kind: "approval",
        what: "Warranty policy wording",
        why: "Draft claim cannot be published without it",
        obtainableBy: "client",
        itemType: "file",
        defaultIfSilent: "One-year installation warranty",
        blocks: ["claim/installation-warranty"],
        severity: "launch-blocking",
      },
    ],
    operatorDecisions: [
      {
        id: "OPD-01",
        kind: "ruling",
        gate: "G-V",
        question: "Accept producer's direction?",
        answer: "yes",
        answeredAt: "2026-10-15T10:00:00Z",
        effect: "other",
      },
    ],
    voice: {
      verbatim: [
        {
          id: "VOI-01",
          text: "Европейское качество — доступное каждому",
          sourceRef: "evidence-source/src-01",
          use: "slogan",
        },
      ],
      directives: [
        {
          id: "DIR-01",
          text: "Никаких обещаний без источника",
          sourceRef: "evidence-source/src-01",
          appliesTo: ["composition"],
        },
      ],
      profile: {
        toneOfVoice: {
          tone: "calm",
          posture: "expert",
          readingLevel: "B2",
          avoids: ["hype"],
          prefers: ["concrete numbers"],
        },
        linguisticRules: { ru: ["no anglicisms in headlines"] },
        culturalRules: ["respect local forms of address"],
      },
    },
    visual: {
      conceptId: "concept-1",
      axes: {
        warmth: "neutral",
        contrast: "medium",
        density: "comfortable",
        typographySharpness: "balanced",
        diagramPresence: "minimal",
        photoStance: "documentary",
        motionStance: "restrained",
        textContrast: "aa",
        cornerRadius: "4px",
        borderWeight: "1px",
      },
      palette: { brand: "#1a3a5c", ink: "#111111" },
      fonts: [
        {
          family: "Inter",
          role: "body",
          source: "@fontsource/inter",
          scripts: ["Latn", "Cyrl"],
        },
      ],
      rationale: "quiet, factual",
      // AMD-012/RFC-1357: approved first-fold art direction — required.
      artDirection: {
        firstFold: {
          composition: "text-beside-image",
          surface: "light",
          textSide: "left",
          imageSubject: "quiet workshop interior, morning light",
          slotRef: "SLOT-01",
        },
        imagery: { style: "documentary photography, muted palette" },
        mockAssetRef: "AST-02",
      },
    },
    slotBriefs: [
      {
        id: "SLOT-01",
        intent: "home",
        role: "atmosphere",
        placement: { surface: "first-fold", slotKind: "background" },
        subjectKind: "atmosphere",
        label: "First fold backdrop",
        prompt: "soft morning light over quiet workbenches",
      },
    ],
    assets: [
      {
        id: "AST-01",
        kind: "logo",
        file: `assets/${"b".repeat(64)}.svg`,
        sha256: "sha256:" + "b".repeat(64),
        mediaType: "image/svg+xml",
        origin: "generated",
        rights: { state: "generated" },
        generator: {
          model: "flux-1",
          promptSha256: SHA,
          generatedAt: "2026-10-15T10:00:00Z",
        },
      },
      {
        id: "AST-02",
        kind: "mood",
        file: `assets/${"c".repeat(64)}.webp`,
        sha256: "sha256:" + "c".repeat(64),
        mediaType: "image/webp",
        origin: "generated",
        rights: { state: "generated" },
        depicts: { kind: "atmosphere" },
        generator: {
          model: "flux-1",
          promptSha256: SHA,
          generatedAt: "2026-10-15T10:00:00Z",
          conceptId: "concept-1",
        },
      },
    ],
    provenance: {
      producer: "site-werkstatt",
      producerVersion: "0.1.0",
      runId: "run-2026-10-15-01",
      contractSnapshot: SHA,
      inputs: [{ path: ".input/kb.json", sha256: SHA, bytes: 1234 }],
      evidenceLedger: SHA,
      models: [{ step: "phase0-ledger", model: "claude-opus", effort: "high" }],
      quoteCheck: { result: "pass", checked: 2, failed: 0 },
      cost: { currency: "USD", total: 4.2, reportPath: "cost-report.json" },
    },
  };
}

interface ParityFixture {
  name: string;
  build: () => Record<string, unknown>;
  /**
   * The defect is only detectable by a Zod superRefine correlation — the
   * generated JSON-schema projection cannot express if/then conditionals
   * (AMD-007: "the vendored schema cannot key annotations to pbp ids"; the
   * same applies to grantsTier/itemType/choices/generator/licence gates).
   * For these, assert the Zod verdict and record the spec verdict as evidence
   * instead of demanding identical verdicts.
   */
  zodOnly?: boolean;
}

const FIXTURES: ParityFixture[] = [
  { name: "valid-envelope", build: baseEnvelope },
  {
    name: "missing-provenance",
    build: () => {
      const e = baseEnvelope();
      delete e.provenance;
      return e;
    },
  },
  {
    name: "wrong-schema-const",
    build: () => {
      const e = baseEnvelope();
      e.schema = "werkstatt:intake/v1";
      return e;
    },
  },
  {
    name: "gap-without-kind",
    build: () => {
      const e = baseEnvelope();
      delete (e.gaps as Record<string, unknown>[])[0].kind;
      return e;
    },
  },
  {
    name: "decision-without-effect",
    build: () => {
      const e = baseEnvelope();
      delete (e.operatorDecisions as Record<string, unknown>[])[0].effect;
      return e;
    },
  },
  {
    name: "publication-tier-decision-without-grantsTier",
    zodOnly: true,
    build: () => {
      const e = baseEnvelope();
      const decision = (e.operatorDecisions as Record<string, unknown>[])[0];
      decision.effect = "publication-tier";
      decision.appliesTo = ["claim/installation-warranty"];
      return e;
    },
  },
  {
    name: "grantsTier-on-non-tier-effect",
    zodOnly: true,
    build: () => {
      const e = baseEnvelope();
      const decision = (e.operatorDecisions as Record<string, unknown>[])[0];
      decision.grantsTier = "preview";
      return e;
    },
  },
  {
    name: "annotation-empty-blockers",
    build: () => {
      const e = baseEnvelope();
      (e.annotations as Record<string, unknown>)["claim/installation-warranty"] = {
        blockers: [],
      };
      return e;
    },
  },
  {
    name: "bad-systemId",
    build: () => {
      const e = baseEnvelope();
      e.systemId = "Bad System!";
      return e;
    },
  },
  {
    name: "gap-without-defaultIfSilent",
    build: () => {
      const e = baseEnvelope();
      delete (e.gaps as Record<string, unknown>[])[0].defaultIfSilent;
      return e;
    },
  },
  {
    name: "client-gap-without-itemType",
    zodOnly: true,
    build: () => {
      const e = baseEnvelope();
      delete (e.gaps as Record<string, unknown>[])[0].itemType;
      return e;
    },
  },
  {
    name: "choice-gap-without-choices",
    zodOnly: true,
    build: () => {
      const e = baseEnvelope();
      const gap = (e.gaps as Record<string, unknown>[])[0];
      gap.itemType = "choice";
      delete gap.choices;
      return e;
    },
  },
  {
    name: "generated-asset-without-generator",
    zodOnly: true,
    build: () => {
      const e = baseEnvelope();
      delete (e.assets as Record<string, unknown>[])[0].generator;
      return e;
    },
  },
  {
    name: "licensed-stock-without-licence",
    zodOnly: true,
    build: () => {
      const e = baseEnvelope();
      const asset = (e.assets as Record<string, unknown>[])[0];
      (asset.rights as Record<string, unknown>).state = "licensed-stock";
      return e;
    },
  },
  {
    name: "clipped-input",
    build: () => {
      const e = baseEnvelope();
      (
        (e.provenance as Record<string, unknown>).inputs as Record<
          string,
          unknown
        >[]
      )[0].clipped = true;
      return e;
    },
  },
  {
    name: "failed-quoteCheck",
    build: () => {
      const e = baseEnvelope();
      (
        (e.provenance as Record<string, unknown>).quoteCheck as Record<
          string,
          unknown
        >
      ).failed = 1;
      return e;
    },
  },
  {
    name: "bad-bcp47-tag",
    build: () => {
      const e = baseEnvelope();
      (
        (e.classification as Record<string, unknown>).locales as Record<
          string,
          unknown
        >[]
      )[0].tag = "uz_Latn";
      return e;
    },
  },
  {
    name: "unknown-top-level-key",
    build: () => {
      const e = baseEnvelope();
      e.unknownField = { x: 1 };
      return e;
    },
  },
  {
    name: "voice-clearance-fields",
    build: () => {
      const e = baseEnvelope();
      const verbatim = (e.voice as Record<string, unknown>).verbatim as Record<string, unknown>[];
      verbatim[0] = {
        ...verbatim[0],
        visibility: "conditional",
        clearedFor: ["chrome-motto", "hero-tagline"],
        blockedBy: ["CLM-01"],
      };
      return e;
    },
  },
  {
    name: "null-profile-fields",
    build: () => {
      const e = baseEnvelope();
      const profile = (e.voice as Record<string, Record<string, unknown>>).profile;
      profile.toneOfVoice = null;
      profile.culturalRules = null;
      return e;
    },
  },
  {
    name: "artDirection-missing",
    build: () => {
      const e = baseEnvelope();
      delete (e.visual as Record<string, unknown>).artDirection;
      return e;
    },
  },
  {
    name: "subjectKind-role-mismatch",
    zodOnly: true,
    build: () => {
      const e = baseEnvelope();
      // represented-product is permitted only on depicts-represented-product —
      // a superRefine correlation the generated JSON-schema cannot express.
      (e.slotBriefs as Record<string, unknown>[])[0].subjectKind = "represented-product";
      return e;
    },
  },
  {
    name: "bad-visibility-enum",
    build: () => {
      const e = baseEnvelope();
      const verbatim = (e.voice as Record<string, unknown>).verbatim as Record<string, unknown>[];
      verbatim[0].visibility = "secret";
      return e;
    },
  },
];

describe("intake envelope — Zod/spec-schema parity (RFC-1281 AC-7)", () => {
  for (const fixture of FIXTURES) {
    it(`fixture ${fixture.name}: identical verdict`, () => {
      const candidate = fixture.build();
      const specVerdict = Boolean(specValidate(candidate));
      const zodVerdict = intakeEnvelopeSchema.safeParse(candidate).success;
      if (fixture.zodOnly) {
        expect(
          zodVerdict,
          `zod-only conditional — spec=${specVerdict} (the vendored JSON-schema cannot express the correlation)`,
        ).toBe(false);
        return;
      }
      expect(
        zodVerdict,
        `spec=${specVerdict} zod=${zodVerdict} specErrors=${JSON.stringify(specValidate.errors)}`,
      ).toBe(specVerdict);
    });
  }
});
