/*
<MODULE_CONTRACT>
<purpose>
Unit tests for manifest covering systemManifestSchema; systemCollectionSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the manifest suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { systemManifestSchema, systemCollectionSchema } from "../manifest.ts";

describe("systemManifestSchema", () => {
  it("is defined", () => {
    expect(systemManifestSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => systemManifestSchema.parse(null)).toThrow();
  });
});

describe("systemCollectionSchema", () => {
  it("is defined", () => {
    expect(systemCollectionSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => systemCollectionSchema.parse(null)).toThrow();
  });
});
