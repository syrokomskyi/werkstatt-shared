import { describe, it, expect } from "vitest";
import { AGENT_KNOWLEDGE_DOMAINS, isAgentKnowledgeDomain } from "../knowledge.ts";

describe("AGENT_KNOWLEDGE_DOMAINS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(AGENT_KNOWLEDGE_DOMAINS)).toBe(true);
    expect(AGENT_KNOWLEDGE_DOMAINS.length).toBeGreaterThan(0);
  });
});

describe("isAgentKnowledgeDomain", () => {
  it("returns true for valid domain", () => {
    const firstDomain = AGENT_KNOWLEDGE_DOMAINS[0];
    expect(isAgentKnowledgeDomain(firstDomain)).toBe(true);
  });

  it("returns false for invalid domain", () => {
    expect(isAgentKnowledgeDomain("invalid-domain")).toBe(false);
  });
});
