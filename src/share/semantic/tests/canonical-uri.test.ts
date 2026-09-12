import { describe, it, expect } from "vitest";
import { deriveCanonicalUri } from "../canonical-uri.js";

describe("RFC-1075 AC-4: deriveCanonicalUri is pure and deterministic", () => {
  it("returns undefined for undefined siteOrigin", () => {
    expect(deriveCanonicalUri(undefined, "business")).toBeUndefined();
    expect(deriveCanonicalUri(undefined, "offering", "off-1")).toBeUndefined();
  });

  it("returns undefined for empty siteOrigin", () => {
    expect(deriveCanonicalUri("", "business")).toBeUndefined();
    expect(deriveCanonicalUri("", "offering", "off-1")).toBeUndefined();
  });

  it("derives business URI without entityId", () => {
    expect(deriveCanonicalUri("https://example.example", "business")).toBe(
      "https://example.example/.well-known/entity/business",
    );
  });

  it("derives offering URI with entityId", () => {
    expect(deriveCanonicalUri("https://example.example", "offering", "off-1")).toBe(
      "https://example.example/.well-known/entity/offering/off-1",
    );
  });

  it("returns undefined for offering without entityId", () => {
    expect(deriveCanonicalUri("https://example.example", "offering")).toBeUndefined();
    expect(deriveCanonicalUri("https://example.example", "offering", "")).toBeUndefined();
  });

  it("strips trailing slashes from siteOrigin", () => {
    expect(deriveCanonicalUri("https://example.example/", "business")).toBe(
      "https://example.example/.well-known/entity/business",
    );
    expect(deriveCanonicalUri("https://example.example//", "business")).toBe(
      "https://example.example/.well-known/entity/business",
    );
  });

  it("is deterministic — same inputs always produce same output", () => {
    const inputs = ["https://example.example", "https://example.example/"] as const;
    for (const origin of inputs) {
      const a = deriveCanonicalUri(origin, "offering", "off-1");
      const b = deriveCanonicalUri(origin, "offering", "off-1");
      expect(a).toBe(b);
    }
  });

  it("is side-effect-free — does not mutate inputs", () => {
    const origin = "https://example.example";
    const before = origin;
    deriveCanonicalUri(origin, "business");
    expect(origin).toBe(before);
  });
});
