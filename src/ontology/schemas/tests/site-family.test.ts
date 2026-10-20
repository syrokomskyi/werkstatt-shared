/*
<MODULE_CONTRACT>
<purpose>
Unit tests for site family covering siteFamilySchema; SiteFamilyContract. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the site suite's contract for test-file scaffold coverage.</item>
  <item>RFC-1344: visitorQuestions acceptance — valid shape, id uniqueness, closed placement enum.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { siteFamilySchema, SiteFamilyContract } from "../site-family.ts";

const minimalFamily = {
  id: "test-family",
  displayName: "Test family",
  version: "1.0.0",
  description: "Fixture family for schema tests.",
  detection: {
    signals: { audienceAny: ["testers"] },
    threshold: 0.5,
  },
  recipe: {
    candidateBiomes: ["biome-a"],
    candidateConstellations: ["constellation-a"],
    requiredSectionArchetypes: ["hero"],
    conversionGoals: {
      primary: { id: "cta", eventName: "cta-clicked" },
    },
    auditThresholds: {},
    agentReadinessBaseline: { maxBytesToCta: 4096 },
  },
};

describe("siteFamilySchema", () => {
  it("is defined", () => {
    expect(siteFamilySchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => siteFamilySchema.parse(null)).toThrow();
  });
});

describe("siteFamilySchema.visitorQuestions (RFC-1344)", () => {
  it("accepts a family without visitorQuestions (optional field)", () => {
    expect(siteFamilySchema.safeParse(minimalFamily).success).toBe(true);
  });

  it("accepts visitorQuestions with home and within-one-hop placements", () => {
    const result = siteFamilySchema.safeParse({
      ...minimalFamily,
      visitorQuestions: [
        { id: "what-represents", prompt: "What do they sell?", placement: "home" },
        { id: "which-catalogs", prompt: "Which catalogs?", placement: "within-one-hop" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects duplicate visitor question ids", () => {
    const result = siteFamilySchema.safeParse({
      ...minimalFamily,
      visitorQuestions: [
        { id: "dup", prompt: "One", placement: "home" },
        { id: "dup", prompt: "Two", placement: "home" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a placement outside the closed enum", () => {
    const result = siteFamilySchema.safeParse({
      ...minimalFamily,
      visitorQuestions: [{ id: "q", prompt: "Q?", placement: "footer" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-kebab question id and empty prompt", () => {
    const badId = siteFamilySchema.safeParse({
      ...minimalFamily,
      visitorQuestions: [{ id: "Bad Id", prompt: "Q?", placement: "home" }],
    });
    const emptyPrompt = siteFamilySchema.safeParse({
      ...minimalFamily,
      visitorQuestions: [{ id: "q", prompt: "", placement: "home" }],
    });
    expect(badId.success).toBe(false);
    expect(emptyPrompt.success).toBe(false);
  });
});

describe("SiteFamilyContract", () => {
  it("is the same schema as siteFamilySchema", () => {
    expect(SiteFamilyContract).toBe(siteFamilySchema);
  });
});
