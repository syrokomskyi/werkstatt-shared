/*
<MODULE_CONTRACT>
<purpose>
Unit tests for biome covering biomeProvenanceSchema union (RFC-1298). It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the biome suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { biomeProvenanceSchema } from "./biome.ts";

// RFC-1298 AC-8: the provenance union accepts the legacy gen/site shape and
// the intake shape, and rejects objects mixing fields from both.
describe("biomeProvenanceSchema union (RFC-1298)", () => {
  const legacy = {
    client: "warpgogol",
    selectedConcept: "concept-02",
    selectedDirection: 2,
    sourceFiles: ["01-brief.md", "02-visual.md"],
  };

  const intake = {
    client: "dp7",
    intakeId: "int_019a8f3e-7c2d-7f1a-8b9c-0123456789ab",
    selectedConcept: "concept-2",
    intakeSha256: `sha256:${"a".repeat(64)}`,
  };

  it("accepts the legacy gen/site shape", () => {
    expect(biomeProvenanceSchema.safeParse(legacy).success).toBe(true);
  });

  it("accepts the intake shape", () => {
    expect(biomeProvenanceSchema.safeParse(intake).success).toBe(true);
  });

  it("rejects an object mixing both shapes (strict union members)", () => {
    const mixed = { ...legacy, intakeId: intake.intakeId, intakeSha256: intake.intakeSha256 };
    expect(biomeProvenanceSchema.safeParse(mixed).success).toBe(false);
  });

  it("rejects an intake shape with a malformed intakeId", () => {
    expect(
      biomeProvenanceSchema.safeParse({ ...intake, intakeId: "not-an-intake-id" }).success,
    ).toBe(false);
  });

  it("rejects an intake shape with a non-sha256 digest", () => {
    expect(biomeProvenanceSchema.safeParse({ ...intake, intakeSha256: "deadbeef" }).success).toBe(
      false,
    );
  });
});
