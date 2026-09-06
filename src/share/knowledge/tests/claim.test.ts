import { describe, it, expect } from "vitest";
import { CLAIM_PROVENANCE_KINDS } from "../claim.ts";

describe("CLAIM_PROVENANCE_KINDS", () => {
  it("contains expected provenance kinds", () => {
    expect(CLAIM_PROVENANCE_KINDS).toContain("external");
    expect(CLAIM_PROVENANCE_KINDS).toContain("derived");
    expect(CLAIM_PROVENANCE_KINDS).toContain("asserted");
    expect(CLAIM_PROVENANCE_KINDS).toContain("generated");
  });
});
