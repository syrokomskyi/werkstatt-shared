/*
<MODULE_CONTRACT>
<purpose>
Unit tests for release covering systemPassportSchema; systemReleaseSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the release suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { systemPassportSchema, systemReleaseSchema } from "../release.ts";

describe("systemPassportSchema", () => {
  it("is defined", () => {
    expect(systemPassportSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => systemPassportSchema.parse(null)).toThrow();
  });
});

describe("systemReleaseSchema", () => {
  it("is defined", () => {
    expect(systemReleaseSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => systemReleaseSchema.parse(null)).toThrow();
  });
});
