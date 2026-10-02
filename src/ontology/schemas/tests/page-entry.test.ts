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
