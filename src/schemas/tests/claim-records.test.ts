/*
<MODULE_CONTRACT>
<purpose>
Unit tests for claim records covering claimSourceRefSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the claim suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { claimSourceRefSchema } from "../claim-records.ts";

describe("claimSourceRefSchema", () => {
  it("accepts a valid source ref", () => {
    const ref = {
      sourceId: "src-1",
      url: "https://example.com",
      title: "Example",
      retrievedAt: "2026-01-01",
    };
    expect(claimSourceRefSchema.parse(ref)).toEqual(ref);
  });

  it("rejects missing required fields", () => {
    expect(() => claimSourceRefSchema.parse({ sourceId: "src-1" })).toThrow();
  });

  it("rejects invalid URL", () => {
    expect(() =>
      claimSourceRefSchema.parse({
        sourceId: "src-1",
        url: "not-a-url",
        title: "Example",
        retrievedAt: "2026-01-01",
      }),
    ).toThrow();
  });

  it("rejects invalid date format", () => {
    expect(() =>
      claimSourceRefSchema.parse({
        sourceId: "src-1",
        url: "https://example.com",
        title: "Example",
        retrievedAt: "01/01/2026",
      }),
    ).toThrow();
  });

  it("rejects extra keys (strict)", () => {
    expect(() =>
      claimSourceRefSchema.parse({
        sourceId: "src-1",
        url: "https://example.com",
        title: "Example",
        retrievedAt: "2026-01-01",
        extra: true,
      }),
    ).toThrow();
  });
});
