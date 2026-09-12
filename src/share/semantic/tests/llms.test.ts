import { describe, expect, it } from "vitest";
import { buildLlmsFull, buildLlmsIndex } from "../llms.ts";
import { makePage } from "./helpers.ts";
import type { SemanticSiteModel } from "../models.ts";
import type { SemanticClaimProvenance } from "../business-projection.ts";

function makeSite(overrides: Partial<SemanticSiteModel> = {}): SemanticSiteModel {
  const page = makePage();
  return {
    organization: page.organization,
    baseUrl: "https://example.com",
    defaultLanguage: "de",
    lang: "de",
    pages: [page],
    ...overrides,
  };
}

describe("buildLlmsIndex", () => {
  it("produces llms.txt with site name and description", () => {
    const site = makeSite();
    const result = buildLlmsIndex(site);
    expect(result).toContain("# Warpgogol");
    expect(result).toContain("Digital infrastructure for nonprofits");
    expect(result).toContain("## Primary sources");
  });

  it("includes llms-full.txt reference", () => {
    const site = makeSite();
    const result = buildLlmsIndex(site);
    expect(result).toContain("llms-full.txt");
  });

  it("includes page links with absolute URLs", () => {
    const site = makeSite();
    const result = buildLlmsIndex(site);
    expect(result).toContain("https://example.com");
  });

  it("filters out excluded pages from index", () => {
    const page = makePage({
      output: {
        sitemap: { include: true, category: "content", includeLastmod: true },
        llms: { depth: "exclude" },
        robots: { index: true, follow: true },
      },
    });
    const site = makeSite({ pages: [page] });
    const result = buildLlmsIndex(site);
    expect(result).not.toContain("Test Page");
  });

  it("includes agent discovery links when agent.enabled is not false", () => {
    const site = makeSite();
    const result = buildLlmsIndex(site);
    expect(result).toContain("agent.json");
  });

  it("omits agent discovery links when agent.enabled is false", () => {
    const site = makeSite({ agent: { enabled: false } } as never);
    const result = buildLlmsIndex(site);
    expect(result).not.toContain("agent.json");
  });

  it("includes organization facts section", () => {
    const site = makeSite();
    const result = buildLlmsIndex(site);
    expect(result).toContain("## Organization");
  });
});

describe("buildLlmsFull", () => {
  it("produces llms-full.txt with site name and description", () => {
    const site = makeSite();
    const result = buildLlmsFull(site);
    expect(result).toContain("# Warpgogol");
    expect(result).toContain("Digital infrastructure for nonprofits");
  });

  it("includes page sections for full depth pages", () => {
    const site = makeSite();
    const result = buildLlmsFull(site);
    expect(result).toContain("## Test Heading");
  });

  it("includes page header but not body for summary depth", () => {
    const page = makePage({
      output: {
        sitemap: { include: true, category: "content", includeLastmod: true },
        llms: { depth: "summary" },
        robots: { index: true, follow: true },
      },
    });
    const site = makeSite({ pages: [page] });
    const result = buildLlmsFull(site);
    expect(result).toContain("## Test Heading");
    expect(result).toContain("URL:");
    expect(result).toContain("Description:");
  });

  it("filters out excluded pages", () => {
    const page = makePage({
      output: {
        sitemap: { include: true, category: "content", includeLastmod: true },
        llms: { depth: "exclude" },
        robots: { index: true, follow: true },
      },
    });
    const site = makeSite({ pages: [page] });
    const result = buildLlmsFull(site);
    expect(result).not.toContain("## Test Page");
  });

  it("includes organization facts section", () => {
    const site = makeSite();
    const result = buildLlmsFull(site);
    expect(result).toContain("## Organization facts");
  });

  it("includes claims section when claims are present", () => {
    const claims: SemanticClaimProvenance[] = [
      {
        id: "c1",
        claimClass: "factual",
        claimKind: "fact",
        statement: "We are certified",
        verificationLevel: "N2",
        confidence: "high",
        evidence: [{ id: "ev1", kind: "certificate", label: "ISO 27001", sha256: "abc123" }],
      },
    ];
    const site = makeSite({ claims });
    const result = buildLlmsFull(site);
    expect(result).toContain("## Claims");
    expect(result).toContain("### We are certified");
    expect(result).toContain("- Class: factual");
    expect(result).toContain("- Verification: N2");
    expect(result).toContain("- Confidence: high");
    expect(result).toContain("- Evidence:");
    expect(result).toContain("certificate: ISO 27001");
    expect(result).toContain("sha256: abc123");
  });

  it("omits claims section when no claims", () => {
    const site = makeSite();
    const result = buildLlmsFull(site);
    expect(result).not.toContain("## Claims");
  });

  it("shows Evidence: none when claim has no evidence", () => {
    const claims: SemanticClaimProvenance[] = [
      {
        id: "c1",
        claimClass: "factual",
        claimKind: "fact",
        statement: "Unevidenced claim",
        evidence: [],
      },
    ];
    const site = makeSite({ claims });
    const result = buildLlmsFull(site);
    expect(result).toContain("- Evidence: none");
  });
});
