import { describe, it, expect } from "vitest";
import { BlockEntrySchema, PageEntrySchema } from "../page-entry.ts";

describe("BlockEntrySchema", () => {
  it("is defined", () => {
    expect(BlockEntrySchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => BlockEntrySchema.parse(null)).toThrow();
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
