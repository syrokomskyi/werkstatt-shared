import { describe, it, expect } from "vitest";
import {
  AGENT_SURFACE_VERSION,
  buildAgentSurfaceManifest,
  type AgentClaimRef,
} from "../manifest.ts";

describe("AGENT_SURFACE_VERSION", () => {
  it("is a version string", () => {
    expect(typeof AGENT_SURFACE_VERSION).toBe("string");
    expect(AGENT_SURFACE_VERSION).toMatch(/\d+\.\d+\.\d+/);
  });

  it("is 1.1.0 (RFC-1076 bump)", () => {
    expect(AGENT_SURFACE_VERSION).toBe("1.1.0");
  });
});

describe("buildAgentSurfaceManifest — claims", () => {
  const baseInput = {
    site: "test-site",
    baseUrl: "https://example.com",
    languages: { default: "de", supported: ["de"] },
    knowledge: [],
    actions: [],
    hasTwins: true,
    openapiUrl: "/.well-known/agent.openapi.json",
    mcp: { url: "/api/agent/mcp", protocolVersion: "2025-06-18" },
    search: null,
  };

  it("includes claims array in the manifest", () => {
    const claims: AgentClaimRef[] = [
      { id: "c2", claimClass: "factual", statement: "B claim", evidenceCount: 1 },
      {
        id: "c1",
        claimClass: "benefit",
        statement: "A claim",
        verificationLevel: "N1",
        evidenceCount: 0,
      },
    ];
    const result = buildAgentSurfaceManifest({ ...baseInput, claims });
    expect(result.claims).toHaveLength(2);
    expect(result.claims[0].id).toBe("c1");
    expect(result.claims[1].id).toBe("c2");
  });

  it("sorts claims by id", () => {
    const claims: AgentClaimRef[] = [
      { id: "z-claim", claimClass: "factual", statement: "Z", evidenceCount: 0 },
      { id: "a-claim", claimClass: "factual", statement: "A", evidenceCount: 0 },
    ];
    const result = buildAgentSurfaceManifest({ ...baseInput, claims });
    expect(result.claims[0].id).toBe("a-claim");
    expect(result.claims[1].id).toBe("z-claim");
  });

  it("defaults to empty claims array when not provided", () => {
    const result = buildAgentSurfaceManifest(baseInput);
    expect(result.claims).toEqual([]);
  });
});
