import { test, expect } from "vitest";
import { buildPage, type PageEntry } from "../page.ts";
import { EMPTY_RUNTIME_CONTEXT } from "../../runtime/runtime-context.ts";

/*
<MODULE_CONTRACT>
<purpose>
  RFC-0263: parity fixture — captures buildPage's hideSectionNumber injection
  behavior for hero-role blocks (Europa, Phobos) and confirms a non-hero block
  never receives the prop. Written against the roleByCosmicName-driven
  implementation (which replaced the UNNUMBERED_HERO_PLANETS literal set) to
  guard byte-identical output going forward.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the hero suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

function fixtureEntry(): PageEntry {
  return {
    kind: "page",
    cosmicStar: "TestStar",
    title: "Test",
    description: "Test page",
    lang: "en",
    blocks: [
      { id: "hero-block", type: "Europa", props: { title: "Hero" } }, // cosmic-literals-ignore: fixture cosmicName for the hero-role parity assertion
      { id: "hero-decision-block", type: "Phobos", props: { title: "Decision hero" } }, // cosmic-literals-ignore: fixture cosmicName for the hero-role parity assertion
      { id: "problem-block", type: "Callisto", props: { title: "Problem" } }, // cosmic-literals-ignore: fixture cosmicName for the non-hero control assertion
    ],
  };
}

test("buildPage: hero-role blocks (Europa, Phobos) get hideSectionNumber injected", async () => {
  const entry = fixtureEntry();
  const ctx = EMPTY_RUNTIME_CONTEXT("en");

  const page = await buildPage(entry, ctx, {
    resolveImportPath: () => "@warpgogol/werkstatt-site/ui/sections/fixture-section.astro",
  });

  expect(page.blocks.length).toBe(3);

  const hero = page.blocks.find((b) => b.id === "hero-block");
  expect(hero?.props).toEqual({ title: "Hero", hideSectionNumber: true });

  const heroDecision = page.blocks.find((b) => b.id === "hero-decision-block");
  expect(heroDecision?.props).toEqual({ title: "Decision hero", hideSectionNumber: true });

  const problem = page.blocks.find((b) => b.id === "problem-block");
  expect(problem?.props).toEqual({ title: "Problem" });
  expect("hideSectionNumber" in (problem?.props ?? {})).toBe(false);
});
