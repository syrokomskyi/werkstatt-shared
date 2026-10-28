import { describe, expect, it } from "vitest";
import {
  AUTO_INJECTED_BLOCK_TYPES,
  AUTO_INJECTED_COSMIC_NAMES,
  BLOCK_TYPE_TO_COSMIC_NAME,
} from "@warpgogol/werkstatt-shared/page";

/*
<MODULE_CONTRACT>
  <purpose>
    Contract test for the RFC-1422 auto-injected block set — the shared source
    of truth consumed by the render-side dedupe and page.block.validate (B-10)
    / manifest.planets.validate (MP-03).
  </purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1422: initial — asserts the auto-injected set resolves through the registry map.</item>
  <item>RFC-1422: forbid authored breadcrumbs blocks and auto-injected planet pins

Shared AUTO_INJECTED_COSMIC_NAMES (werkstatt-shared/page) is the single source
of truth consumed by render-side dedupe and both validators. page.block.validate
gains B-10 (B-family, PAGE-BLOCK-01 catch-all) rejecting authored blocks that
resolve to an auto-injected cosmic name; manifest.planets.validate gains MP-03
(error) for pinned auto-injected planets while MP-01 keeps warning on genuinely
stale pins. injectBreadcrumbsBlock strips an authored auto-injected block
defensively so it can never suppress or duplicate the canonical injected trail.
compose-scaffold stops emitting Thebe pins; golden fixture and live
systems-cache content are swept; AGENTS templates state the enforcement rule.</item>
</CHANGE_SUMMARY>
*/

describe("AUTO_INJECTED_COSMIC_NAMES (RFC-1422)", () => {
  it("resolves every auto-injected block type through the registry map", () => {
    expect(AUTO_INJECTED_BLOCK_TYPES).toContain("breadcrumbs");
    expect(AUTO_INJECTED_COSMIC_NAMES.has("Thebe")).toBe(true);
    for (const type of AUTO_INJECTED_BLOCK_TYPES) {
      expect(AUTO_INJECTED_COSMIC_NAMES.has(BLOCK_TYPE_TO_COSMIC_NAME[type] ?? type)).toBe(true);
    }
  });
});
