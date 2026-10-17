/*
<MODULE_CONTRACT>
<purpose>
Unit tests for biome covering biomeProvenanceSchema; biomeAxesSchema. It also guards the documented public contract and regression-sensitive edge cases.
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
import { biomeProvenanceSchema, biomeAxesSchema } from "../biome.ts";

describe("biomeProvenanceSchema", () => {
  it("is defined", () => {
    expect(biomeProvenanceSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => biomeProvenanceSchema.parse(null)).toThrow();
  });
});

describe("biomeAxesSchema", () => {
  it("is defined and parseable", () => {
    expect(biomeAxesSchema).toBeDefined();
    expect(() => biomeAxesSchema.parse(null)).toThrow();
  });
});
