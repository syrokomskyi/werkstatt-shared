/*
<MODULE_CONTRACT>
<purpose>
Unit tests for verification covering systemVerificationSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the verification suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { systemVerificationSchema } from "../verification.ts";

describe("systemVerificationSchema", () => {
  it("is defined", () => {
    expect(systemVerificationSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => systemVerificationSchema.parse(null)).toThrow();
  });
});
