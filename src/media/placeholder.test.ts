/*
<MODULE_CONTRACT>
<purpose>RFC-1346: slot-placeholder renderer tests — deterministic SVG output,
aspect parsing/fallback, token/basename derivation, XML escaping, and the
credit/register record shapes that force the derived tier to preview.</purpose>
<non-goals>
  <item>Do not test rasterization — sharp lives in the engine; webp-encoder covers the encode side.</item>
  <item>Do not test seeding — the engine's register-intake suite covers planner placement.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1346/AMD-010: created — deterministic renderer + record-builder tests.</item>
  <item>RFC-1346: defer final image generation to a post-approval asset.slot.fulfill command</item>
  <item>RFC-1346: implement: defer final image generation to post-approval asset.slot.fulfill — intake slotBriefs (INTAKE-24/25), material-credit placeholder sourceType + derivedFrom union, register origin/emitted, deterministic biome placeholder renderer + register seeding, publication-tier preview on placeholder-origin rows, imageSlots aspect, asset.slot.fulfill command (visual-review gate, source-first, provider seam, evidence), AMD-010 + fixtures regenerated</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";

import { materialCreditSchema } from "../schemas/material-credit.ts";
import { publicationRegisterSchema } from "../ontology/schemas/publication-register.ts";
import {
  parseAspectRatio,
  placeholderBasename,
  placeholderCreditRecord,
  placeholderRegisterEntry,
  placeholderStem,
  renderSlotPlaceholderSvg,
  PLACEHOLDER_CANVAS_WIDTH,
} from "./placeholder.ts";

const PALETTE = { surface: "#F3E6D8", brand: "#8C4A3A", ink: "#3A2E2A" };
const brief = (over: Record<string, unknown> = {}) => ({
  slotId: "SLOT-01",
  label: "Warm courtyard still life, no products",
  aspectHint: "3:2",
  palette: PALETTE,
  bodyFamily: "'Raleway', sans-serif",
  ...over,
});

describe("parseAspectRatio", () => {
  it("parses W:H hints and falls back to 3:2", () => {
    expect(parseAspectRatio("16:9")).toEqual({ w: 16, h: 9 });
    expect(parseAspectRatio(undefined)).toEqual({ w: 3, h: 2 });
    expect(parseAspectRatio("bogus")).toEqual({ w: 3, h: 2 });
    expect(parseAspectRatio("0:0")).toEqual({ w: 3, h: 2 });
  });
});

describe("token derivation", () => {
  it("derives the lowercase token and webp basename", () => {
    expect(placeholderStem("SLOT-01")).toBe("slot-01");
    expect(placeholderBasename("SLOT-01")).toBe("slot-01.webp");
  });
});

describe("renderSlotPlaceholderSvg", () => {
  it("is byte-deterministic for identical input", () => {
    expect(renderSlotPlaceholderSvg(brief())).toBe(renderSlotPlaceholderSvg(brief()));
  });

  it("renders the canvas at the aspect hint and the palette tint", () => {
    const svg = renderSlotPlaceholderSvg(brief({ aspectHint: "4:3" }));
    expect(svg).toContain(`width="${PLACEHOLDER_CANVAS_WIDTH}"`);
    expect(svg).toContain(`height="900"`);
    expect(svg).toContain(`fill="${PALETTE.surface}"`);
    expect(svg).toContain(`stroke="${PALETTE.brand}"`);
    expect(svg).toContain(`fill="${PALETTE.ink}"`);
  });

  it("carries the escaped label and slot id", () => {
    const svg = renderSlotPlaceholderSvg(
      brief({ label: `Still & <quiet> "life"`, slotId: "SLOT-07" }),
    );
    expect(svg).toContain("Still &amp; &lt;quiet&gt; &quot;life&quot;");
    expect(svg).toContain(">SLOT-07</text>");
  });
});

describe("record builders", () => {
  it("placeholder credit sidecar parses against materialCreditSchema", () => {
    const credit = materialCreditSchema.parse(
      placeholderCreditRecord({ slotId: "SLOT-01", lang: "ru" }),
    );
    expect(credit.sourceType).toBe("placeholder");
    expect(credit.derivedFrom).toEqual({ slotBrief: "SLOT-01" });
    expect(credit.target.id).toBe("slot-01");
    expect(credit.target.domain).toBe("pages");
    expect(credit.target.lang).toBe("ru");
  });

  it("register entry forces preview with the placeholder origin", () => {
    const entry = placeholderRegisterEntry("pages/ru/assets/slot-01.webp");
    const register = publicationRegisterSchema.parse({
      schema: "werkstatt:publication-register/v1",
      entities: {},
      assets: { "slot-01.webp": entry },
    });
    expect(register.assets["slot-01.webp"]).toEqual({
      ceiling: "preview",
      blockers: [],
      emitted: "pages/ru/assets/slot-01.webp",
      origin: "placeholder",
    });
  });
});
