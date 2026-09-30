/*
<MODULE_CONTRACT>
<purpose>RFC-1175 AC-5: structural coverage for the single-chunk orchestrator — self-gating feature modules stay statically imported so the entry script's one dynamic import resolves the whole dispatch graph; heavy third-party deps remain lazy inside each init.</purpose>
<keywords>RFC-1175, orchestrator, chunks, test</keywords>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1175: initial orchestrator chunk-topology tests.</item>
</CHANGE_SUMMARY>
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readSource = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");

const DYNAMIC_RELATIVE_IMPORT = /import\(\s*["']\.\//g;

describe("orchestrator chunk topology (RFC-1175 AC-5)", () => {
  it("orchestrator.ts contains no dynamic relative imports — dispatch code lives in the orchestrator chunk", () => {
    const source = readSource("orchestrator.ts");
    expect(source.match(DYNAMIC_RELATIVE_IMPORT) ?? []).toEqual([]);
  });

  it("orchestrator.ts statically imports every self-gating feature module", () => {
    const source = readSource("orchestrator.ts");
    for (const specifier of [
      "./external-links.ts",
      "./lordicon.ts",
      "./lenis.ts",
      "./scroll-spy.ts",
      "./background-video.ts",
      "./external-link-qr.ts",
      "./gsap-counter.ts",
      "./gsap-parallax.ts",
      "./gsap-reveal.ts",
      "./gsap-stagger.ts",
      "./inline-number-animation.ts",
      "./live-photos.ts",
      "./video-player.ts",
      "./scheduler.ts",
    ]) {
      expect(source).toContain(`from "${specifier}"`);
    }
  });

  it("lordicon.ts keeps only the heavy @lordicon/element import dynamic", () => {
    const source = readSource("lordicon.ts");
    expect(source.match(DYNAMIC_RELATIVE_IMPORT) ?? []).toEqual([]);
    expect(source).toContain('await import("@lordicon/element")');
  });

  it("lordicon.ts does not prefetch inlined data: URIs", () => {
    const source = readSource("lordicon.ts");
    expect(source).toContain('url.startsWith("data:")');
  });

  it("video-player.ts keeps plyr.css lazy — no top-level stylesheet import", () => {
    const source = readSource("video-player.ts");
    const topLevel = source
      .split("\n")
      .filter((line) => line.startsWith("import "))
      .join("\n");
    expect(topLevel).not.toContain("plyr/dist/plyr.css");
    expect(source).toContain('await import("plyr/dist/plyr.css")');
  });
});
