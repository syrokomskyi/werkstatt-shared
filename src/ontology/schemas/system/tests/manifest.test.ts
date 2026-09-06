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
