/*
<MODULE_CONTRACT>
<purpose>
Unit tests for sternsystem onboarding state covering systemStateSchema onboarding block (RFC-1307).
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the sternsystem suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";
import { systemStateSchema } from "./sternsystem.ts";

const base = { schemaVersion: "1", systemId: "dp7" };
const digest = `sha256:${"a".repeat(64)}`;

describe("systemStateSchema onboarding block (RFC-1307)", () => {
  it("accepts a well-formed onboarding provenance block", () => {
    const parsed = systemStateSchema.safeParse({
      ...base,
      onboarding: {
        intakeId: "int_01a14144-caf0-736d-b847-ca9924bc6191",
        intakeSha256: digest,
        contractSnapshot: digest,
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an intakeSha256 that is not sha256:<64 hex>", () => {
    const parsed = systemStateSchema.safeParse({
      ...base,
      onboarding: {
        intakeId: "int_01a14144-caf0-736d-b847-ca9924bc6191",
        intakeSha256: "abc",
        contractSnapshot: digest,
      },
    });
    expect(parsed.success, "onboarding.intakeSha256 must be validated as sha256:<64 hex>").toBe(
      false,
    );
  });

  it("stays optional for systems born before intake registration", () => {
    expect(systemStateSchema.safeParse(base).success).toBe(true);
  });
});
