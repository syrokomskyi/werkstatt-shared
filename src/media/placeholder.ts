/*
<MODULE_CONTRACT>
<purpose>RFC-1346: deterministic biome-tinted placeholder renderer for
intake `slotBriefs[]` — the SVG template is produced here; rasterization to
WebP is performed by an injected encoder (this package carries no native
deps). Placeholders are never real media: they carry the brief label on the
biome surface tint, and force the derived publication tier to `preview` via
register `origin: "placeholder"` entries.</purpose>
<non-goals>
  <item>Do not write files or read the biome — the command layer resolves the palette and owns writes.</item>
  <item>Do not encode WebP itself — rasterization is injected (sharp lives in the engine).</item>
  <item>Do not guess the composed location — `asset.slot.fulfill` scans workpiece pages for the emitted token.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>The emitted token `slot-&lt;id&gt;` is the placeholder's identity end-to-end: basename of the seeded file, the frontmatter image value the composer writes, and the exact string `asset.slot.fulfill` replaces.</item>
  <item>SVG output is byte-deterministic (no timestamps, no randomness); the injected rasterizer decides final bytes — same SVG + same encoder ⇒ same WebP.</item>
  <item>Placeholder ceiling is unconditional `preview` — a stand-in is never publishable; `awaitingGap` governs the real media, not the stand-in.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1346/AMD-010: created — renderSlotPlaceholderSvg + credit/register record builders.</item>
  <item>RFC-1346: defer final image generation to a post-approval asset.slot.fulfill command</item>
  <item>RFC-1346: implement: defer final image generation to post-approval asset.slot.fulfill — intake slotBriefs (INTAKE-24/25), material-credit placeholder sourceType + derivedFrom union, register origin/emitted, deterministic biome placeholder renderer + register seeding, publication-tier preview on placeholder-origin rows, imageSlots aspect, asset.slot.fulfill command (visual-review gate, source-first, provider seam, evidence), AMD-010 + fixtures regenerated</item>
</CHANGE_SUMMARY>
*/

import type { PublicationRegisterAsset } from "../ontology/schemas/publication-register.ts";

/** Rasterized placeholder width in px; height derives from the aspect. */
export const PLACEHOLDER_CANVAS_WIDTH = 1200;

const DEFAULT_ASPECT = { w: 3, h: 2 };

/** Palette subset the placeholder template consumes — biome-resolved upstream. */
export interface PlaceholderPalette {
  surface: string;
  brand: string;
  ink: string;
}

export interface SlotPlaceholderBrief {
  /** `SLOT-NN` — normalized to lowercase inside the emitted token. */
  slotId: string;
  /** Short label rendered on the placeholder (XML-escaped by the renderer). */
  label: string;
  /** `W:H` aspect hint from the brief; absent ⇒ 3:2. */
  aspectHint?: string;
  palette: PlaceholderPalette;
  /** Biome body font stack for the label text. */
  bodyFamily?: string;
}

/**
 * Parse a `W:H` aspect hint into positive integer parts; malformed or absent
 * hints fall back to 3:2 (INTAKE-25 already enforces the shape — this is the
 * belt for hand-built callers).
 */
export function parseAspectRatio(hint: string | undefined): { w: number; h: number } {
  if (!hint) return DEFAULT_ASPECT;
  const m = /^(\d+):(\d+)$/.exec(hint);
  if (!m) return DEFAULT_ASPECT;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? { w, h } : DEFAULT_ASPECT;
}

/** The placeholder token — frontmatter image value and basename stem. */
export function placeholderStem(slotId: string): string {
  return slotId.toLowerCase();
}

/** Emitted filename (`slot-<id>.webp`). */
export function placeholderBasename(slotId: string): string {
  return `${placeholderStem(slotId)}.webp`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Deterministic SVG placeholder: biome `surface` background, `brand`
 * hairline frame, the brief label and slot id centered in the biome body
 * font. Byte-identical for identical input — no timestamps or randomness.
 */
export function renderSlotPlaceholderSvg(brief: SlotPlaceholderBrief): string {
  const { w, h } = parseAspectRatio(brief.aspectHint);
  const width = PLACEHOLDER_CANVAS_WIDTH;
  const height = Math.round((width * h) / w);
  const family = escapeXml(brief.bodyFamily ?? "sans-serif");
  const label = escapeXml(brief.label);
  const slotId = escapeXml(brief.slotId.toUpperCase());
  const labelSize = Math.max(28, Math.min(56, Math.round(width / (label.length + 8))));
  const idSize = Math.round(labelSize * 0.55);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${brief.palette.surface}"/>` +
    `<rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" ` +
    `stroke="${brief.palette.brand}" stroke-width="2"/>` +
    `<text x="${width / 2}" y="${height / 2 - idSize / 2}" text-anchor="middle" ` +
    `font-family="${family}" font-size="${labelSize}" fill="${brief.palette.ink}">${label}</text>` +
    `<text x="${width / 2}" y="${height / 2 + idSize * 1.6}" text-anchor="middle" ` +
    `font-family="${family}" font-size="${idSize}" fill="${brief.palette.ink}" ` +
    `opacity="0.6">${slotId}</text>` +
    `</svg>`
  );
}

/**
 * Material-credit sidecar for a seeded placeholder — `sourceType:
 * "placeholder"` + `derivedFrom.slotBrief`; below-public provenance a reader
 * can never mistake for real media.
 */
export function placeholderCreditRecord(input: {
  slotId: string;
  lang: string;
}): Record<string, unknown> {
  const stem = placeholderStem(input.slotId);
  return {
    id: stem,
    target: { kind: "image", id: stem, domain: "pages", lang: input.lang },
    sourceType: "placeholder",
    status: "needs-review",
    derivedFrom: { slotBrief: input.slotId },
    usageBasis: { type: "unverified", note: "Placeholder — awaiting real media" },
    parties: [
      {
        role: "producer",
        name: "werkstatt placeholder renderer",
        kind: "Workflow",
      },
    ],
    license: { label: "Deterministic placeholder — not publishable content" },
  };
}

/**
 * Register `assets:` entry — `origin: "placeholder"` makes the derived-tier
 * emitter list `slot:<id>` in belowPublic and hold the tier at `preview`.
 */
export function placeholderRegisterEntry(emitted: string): PublicationRegisterAsset {
  return {
    ceiling: "preview",
    blockers: [],
    emitted,
    origin: "placeholder",
  };
}
