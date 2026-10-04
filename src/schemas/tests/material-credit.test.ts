import { describe, it, expect } from "vitest";
import {
  materialKindSchema,
  materialSourceTypeSchema,
  creditPartyKindSchema,
  creditRoleSchema,
  materialCreditStatusSchema,
  usageBasisTypeSchema,
  materialCreditLabelsSchema,
} from "../material-credit.ts";

describe("materialKindSchema", () => {
  it("accepts valid kinds", () => {
    const result = materialKindSchema.safeParse("image");
    expect(result.success).toBe(true);
  });

  it("rejects invalid kind", () => {
    expect(() => materialKindSchema.parse("3d-model")).toThrow();
  });
});

describe("materialSourceTypeSchema", () => {
  it("accepts valid source types", () => {
    const result = materialSourceTypeSchema.safeParse("human-made");
    expect(result.success).toBe(true);
  });

  it("rejects invalid source type", () => {
    expect(() => materialSourceTypeSchema.parse("unknown")).toThrow();
  });
});

describe("creditPartyKindSchema", () => {
  it("accepts valid party kinds", () => {
    const result = creditPartyKindSchema.safeParse("Person");
    expect(result.success).toBe(true);
  });

  it("rejects invalid party kind", () => {
    expect(() => creditPartyKindSchema.parse("Robot")).toThrow();
  });
});

describe("creditRoleSchema", () => {
  it("accepts valid roles", () => {
    const result = creditRoleSchema.safeParse("creator");
    expect(result.success).toBe(true);
  });

  it("rejects invalid role", () => {
    expect(() => creditRoleSchema.parse("owner")).toThrow();
  });
});

// RFC-1189 AC-1: partyKindLabels is a required complete record over
// creditPartyKindSchema — the schema itself is the completeness gate for the
// public credits page's localized kind vocabulary.
const baseLabels = {
  summaryLabel: "Summary",
  pageTitle: "Credits",
  pageDescription: "Material credits",
  emptyMessage: "No credits",
  detailsLabel: "Details",
  createdBy: "Created by",
  createdWith: "Created with",
  promptBy: "Prompt by",
  reviewedBy: "Reviewed by",
  license: "License",
  copyrightLabel: "Copyright",
  rightsHolder: "Rights holder",
  sourceType: "Source type",
  sourceTypeLabels: Object.fromEntries(
    materialSourceTypeSchema.options.map((value) => [value, value]),
  ),
  statusLabels: Object.fromEntries(
    materialCreditStatusSchema.options.map((value) => [value, value]),
  ),
  usageBasisLabels: Object.fromEntries(usageBasisTypeSchema.options.map((value) => [value, value])),
  aiUsageLabels: {
    aiGenerated: "AI-generated",
    aiAssisted: "AI-assisted",
    humanContribution: "Human contribution",
    copyrightClaimed: "Copyright claimed",
    copyrightNotClaimed: "No copyright claim",
  },
  usedOnLabel: "Used on",
  verifiedAtLabel: "Verified at",
  noPreviewLabel: "No preview",
  copyrightExplanation: "Explanation",
};

describe("materialCreditLabelsSchema.partyKindLabels (RFC-1189)", () => {
  const fullPartyKindLabels = Object.fromEntries(
    creditPartyKindSchema.options.map((value) => [value, value]),
  );

  it("rejects a labels block missing partyKindLabels entirely", () => {
    const result = materialCreditLabelsSchema.safeParse(baseLabels);
    expect(
      result.success,
      "partyKindLabels is required — check labels.md materialCredits block",
    ).toBe(false);
  });

  it("rejects a record missing one creditPartyKindSchema member", () => {
    const labels = {
      ...baseLabels,
      partyKindLabels: { ...fullPartyKindLabels, AIPlatform: undefined },
    };
    delete (labels.partyKindLabels as Record<string, string>).AIPlatform;
    const result = materialCreditLabelsSchema.safeParse(labels);
    expect(result.success).toBe(false);
  });

  it("accepts a complete partyKindLabels record", () => {
    const result = materialCreditLabelsSchema.safeParse({
      ...baseLabels,
      partyKindLabels: fullPartyKindLabels,
    });
    expect(result.success).toBe(true);
  });
});
