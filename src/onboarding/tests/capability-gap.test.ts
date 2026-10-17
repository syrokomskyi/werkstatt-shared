/*
<MODULE_CONTRACT>
<purpose>RFC-1299 tests for capabilityGapSchema — the Zod mirror of the
normative spec schema docs/specs/werkstatt-onboarding/schemas/
capability-gap.schema.yaml. Verifies the strict-object contract: valid
records round-trip, malformed ids/hashes/kinds are rejected, and unknown
keys are stripped nowhere (strict objects reject).</purpose>
<non-goals>
  <item>Do not exercise CAPGAP-02/03 semantics — those live in the site validator.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1299: created — schema boundary tests.</item>
  <item>RFC-1299: capability.brief + family.detect + capability.gap.validate</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";

import { capabilityGapSchema } from "../capability-gap.ts";

const VALID_GAP = {
  id: "CAPGAP-001",
  systemId: "dp7",
  kind: "new-family",
  need: {
    statement: "No site family matches the intake classification",
    evidenceRefs: ["evidence-source/src-01"],
  },
  catalogEvidence: {
    capabilityBriefSha256: `sha256:${"0".repeat(64)}`,
    familyScore: 0.5,
    candidates: [
      {
        ref: "family-a",
        whyInsufficient: "unmatched signals: audienceAny",
      },
    ],
  },
  proposal: { functionalName: "donation-kindergarten", track: "data" },
  interim: "compose with the closest family's required archetypes",
};

describe("capabilityGapSchema (RFC-1299)", () => {
  it("accepts a complete new-family record", () => {
    const parsed = capabilityGapSchema.safeParse(VALID_GAP);
    expect(parsed.success).toBe(true);
  });

  it.each([
    ["bad id", { id: "gap-1" }],
    ["bad kind", { kind: "new-planet" }],
    ["empty evidenceRefs", { need: { statement: "s", evidenceRefs: [] } }],
    [
      "bad brief hash",
      {
        catalogEvidence: {
          ...VALID_GAP.catalogEvidence,
          capabilityBriefSha256: "sha256:xyz",
        },
      },
    ],
    [
      "familyScore above 1",
      {
        catalogEvidence: {
          ...VALID_GAP.catalogEvidence,
          familyScore: 1.5,
        },
      },
    ],
    [
      "empty candidates",
      {
        catalogEvidence: { ...VALID_GAP.catalogEvidence, candidates: [] },
      },
    ],
    [
      "bad functionalName",
      { proposal: { functionalName: "DP7 Partners", track: "data" } },
    ],
    [
      "bad track",
      {
        proposal: { functionalName: "partner-locator", track: "code" },
      },
    ],
    ["missing interim", { interim: undefined }],
  ])("rejects a record with %s", (_label, patch) => {
    const record = { ...VALID_GAP, ...patch };
    expect(capabilityGapSchema.safeParse(record).success).toBe(false);
  });

  it("rejects unknown keys (strict mirror of additionalProperties:false)", () => {
    const record = { ...VALID_GAP, note: "operator remark" };
    expect(capabilityGapSchema.safeParse(record).success).toBe(false);
  });

  it("accepts every spec kind", () => {
    for (const kind of [
      "new-section-archetype",
      "section-props-extension",
      "new-family",
      "new-biome",
      "new-constellation",
      "new-pbp-entity-type",
      "new-component",
    ]) {
      expect(
        capabilityGapSchema.safeParse({ ...VALID_GAP, kind }).success,
      ).toBe(true);
    }
  });

  it("familyScore is optional (non-family kinds)", () => {
    const { familyScore: _drop, ...evidence } = VALID_GAP.catalogEvidence;
    const record = { ...VALID_GAP, catalogEvidence: evidence };
    expect(capabilityGapSchema.safeParse(record).success).toBe(true);
  });
});
