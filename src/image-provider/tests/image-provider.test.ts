import { describe, it, expect } from "vitest";
import { createBuildPortableProvider } from "../image-provider.ts";
import type { ImageVariantManifest } from "../image-provider.ts";

const DE = "/src/content/pages/de/assets/star.webp";
const UK = "/src/content/pages/uk/assets/star.webp";
const NEUTRAL = "/src/content/surface/assets/star.webp";

function entry(origin: string) {
  const tag = origin.includes("/de/") ? "de" : origin.includes("/uk/") ? "uk" : "neutral";
  return {
    origin,
    intrinsicWidth: 800,
    intrinsicHeight: 600,
    variants: [
      { width: 320, url: `/_img/star-${tag}/320.webp` },
      { width: 800, url: `/_img/star-${tag}/800.webp` },
    ],
    sourceHash: "0".repeat(64),
    quality: 90,
  };
}

function manifest(origins: string[], byBasename: Record<string, string[]>): ImageVariantManifest {
  return {
    version: 1,
    byOrigin: Object.fromEntries(origins.map((o) => [o, entry(o)])),
    byBasename,
  };
}

describe("createBuildPortableProvider byBasename fallback", () => {
  const starManifest = manifest([DE, UK], { star: [DE, UK] });

  it("picks the lang-matched origin for Astro-hashed descriptors", () => {
    const provider = createBuildPortableProvider(starManifest);
    const sources = provider.buildSources({ src: "/_astro/star.Abc12345.webp" }, { lang: "uk" });
    expect(sources.src).toBe("/_img/star-uk/800.webp");
  });

  it("picks the de origin for a de request", () => {
    const provider = createBuildPortableProvider(starManifest);
    const sources = provider.buildSources({ src: "/_astro/star.Abc12345.webp" }, { lang: "de" });
    expect(sources.src).toBe("/_img/star-de/800.webp");
  });

  it("falls back to the first candidate without a lang request", () => {
    const provider = createBuildPortableProvider(starManifest);
    const sources = provider.buildSources({ src: "/_astro/star.Abc12345.webp" });
    expect(sources.src).toBe("/_img/star-de/800.webp");
  });

  it("tolerates legacy single-string byBasename values", () => {
    const legacy = {
      ...starManifest,
      byBasename: { star: UK } as unknown as Record<string, string[]>,
    };
    const provider = createBuildPortableProvider(legacy);
    const sources = provider.buildSources({ src: "/_astro/star.Abc12345.webp" });
    expect(sources.src).toBe("/_img/star-uk/800.webp");
  });

  it("prefers the lang-scoped candidate over a lang-agnostic one", () => {
    const m = manifest([NEUTRAL, UK], { star: [NEUTRAL, UK] });
    const provider = createBuildPortableProvider(m);
    const sources = provider.buildSources({ src: "/_astro/star.Abc12345.webp" }, { lang: "uk" });
    expect(sources.src).toBe("/_img/star-uk/800.webp");
  });
});
