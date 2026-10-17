/*
<MODULE_CONTRACT>
<purpose>
Unit tests for dns records covering dnsRecordTypeSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the dns suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { dnsRecordTypeSchema } from "../dns-records.ts";

describe("dnsRecordTypeSchema", () => {
  it("accepts valid DNS record types", () => {
    const result = dnsRecordTypeSchema.safeParse("A");
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    expect(() => dnsRecordTypeSchema.parse("INVALID")).toThrow();
  });
});
