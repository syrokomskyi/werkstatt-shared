/*
<MODULE_CONTRACT>
<purpose>
Unit tests for page entry covering BlockEntrySchema; PageEntrySchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the page suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { BlockEntrySchema, PageEntrySchema } from "../page-entry.ts";

describe("BlockEntrySchema", () => {
  it("is defined", () => {
    expect(BlockEntrySchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => BlockEntrySchema.parse(null)).toThrow();
  });

  it("accepts inherit as a pageId string (RFC-1185)", () => {
    const block = BlockEntrySchema.parse({
      id: "hero",
      type: "Europa",
      inherit: "home",
    });
    expect(block.inherit).toBe("home");
  });

  it("accepts inherit: false as an explicit opt-out (RFC-1185)", () => {
    const block = BlockEntrySchema.parse({
      id: "hero",
      type: "Europa",
      inherit: false,
    });
    expect(block.inherit).toBe(false);
  });

  it("leaves inherit undefined when absent (RFC-1185)", () => {
    const block = BlockEntrySchema.parse({ id: "hero", type: "Europa" });
    expect(block.inherit).toBeUndefined();
  });

  it("rejects an empty-string inherit target (RFC-1185)", () => {
    expect(() => BlockEntrySchema.parse({ id: "hero", type: "Europa", inherit: "" })).toThrow();
  });
});

describe("PageEntrySchema", () => {
  it("is defined", () => {
    expect(PageEntrySchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => PageEntrySchema.parse(null)).toThrow();
  });
});
