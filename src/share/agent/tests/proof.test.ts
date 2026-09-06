import { describe, it, expect } from "vitest";
import { AGENT_PROOF_DOMAIN, buildAgentSigningPayload } from "../proof.ts";

describe("AGENT_PROOF_DOMAIN", () => {
  it("is a string constant", () => {
    expect(typeof AGENT_PROOF_DOMAIN).toBe("string");
    expect(AGENT_PROOF_DOMAIN.length).toBeGreaterThan(0);
  });
});

describe("buildAgentSigningPayload", () => {
  it("is a function", () => {
    expect(typeof buildAgentSigningPayload).toBe("function");
  });
});
