/*
<MODULE_CONTRACT>
<purpose>RFC-1345: extraction-core tests — poppler-backed embedded-image and
page-render extraction over a synthetic booklet fixture (no client material),
deterministic naming/dedup/skip behavior, the 400px floor, plus the pure
credit/register record builders.</purpose>
<non-goals>
  <item>Do not test the command wrapper — site-side asset-extract.test.ts covers flags, confinement, idempotency, and register writes.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1345/AMD-009: created — real-poppler extraction over synthetic booklet fixture + record-builder tests.</item>
  <item>RFC-1345: carry source-derived media from client documents through the intake as extracted assets</item>
</CHANGE_SUMMARY>
*/

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createDefaultIO } from "../kernel/workspace-io.ts";
import {
  extractDocumentMedia,
  extractedCreditRecord,
  extractedRegisterEntry,
  extractionCeiling,
  pngDimensions,
  type ExtractionRegion,
} from "./extract-document.ts";

const { io } = createDefaultIO();
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "booklet.pdf");

/** Identity encoder — returns PNG bytes as-is (determinism is what counts). */
const passthrough = async (png: Uint8Array): Promise<Uint8Array> => png;

function workDir(): string {
  return mkdtempSync(join(tmpdir(), "extract-"));
}

const BASE = {
  sourcePath: FIXTURE,
  sourceSha256: "sha256:" + "0".repeat(64),
  encodeWebp: passthrough,
};

describe("extractDocumentMedia — embedded-image", () => {
  it("extracts the page-1 raster, skips the below-floor page and the imageless page", async () => {
    const dir = workDir();
    try {
      const result = await extractDocumentMedia(io, {
        ...BASE,
        workDir: dir,
        hints: [{ page: 1 }, { page: 2 }, { page: 3 }],
      });
      expect(result.method).toBe("embedded-image");
      expect(result.extracted).toHaveLength(1);
      const img = result.extracted[0]!;
      expect(img.page).toBe(1);
      expect(img.width).toBe(800);
      expect(img.height).toBe(600);
      expect(img.basename).toMatch(/^ext-[0-9a-f]{12}\.webp$/);
      expect(img.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
      const reasons = new Map(result.skipped.map((s) => [s.page, s.reason]));
      expect(reasons.get(2)).toContain("400px");
      expect(reasons.get(3)).toContain("no embedded images");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is deterministic — same source + hints yield identical emitted records", async () => {
    const dirA = workDir();
    const dirB = workDir();
    try {
      const a = await extractDocumentMedia(io, { ...BASE, workDir: dirA, hints: [{ page: 1 }] });
      const b = await extractDocumentMedia(io, { ...BASE, workDir: dirB, hints: [{ page: 1 }] });
      expect(a.extracted.map((e) => e.basename)).toEqual(b.extracted.map((e) => e.basename));
      expect(a.extracted.map((e) => e.sha256)).toEqual(b.extracted.map((e) => e.sha256));
      expect(Buffer.from(a.extracted[0]!.webp).equals(b.extracted[0]!.webp)).toBe(true);
    } finally {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    }
  });

  it("--pages subsetting extracts only hinted pages", async () => {
    const dir = workDir();
    try {
      const result = await extractDocumentMedia(io, {
        ...BASE,
        workDir: dir,
        hints: [{ page: 2 }],
      });
      expect(result.extracted).toHaveLength(0);
      expect(result.skipped[0]?.page).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("extractDocumentMedia — page-render", () => {
  it("renders hinted pages at 200dpi and applies the region crop", async () => {
    const dir = workDir();
    try {
      const region: ExtractionRegion = [0.25, 0.25, 0.5, 0.5];
      let cropSeen: { left: number; top: number; width: number; height: number } | undefined;
      const result = await extractDocumentMedia(io, {
        ...BASE,
        workDir: dir,
        method: "page-render",
        hints: [{ page: 1, region }],
        encodeWebp: async (png, crop) => {
          cropSeen = crop;
          return png;
        },
      });
      expect(result.method).toBe("page-render");
      expect(result.extracted).toHaveLength(1);
      const img = result.extracted[0]!;
      // 595x842pt at 200dpi ≈ 1653x2339px; the crop is resolved to pixels.
      expect(cropSeen).toBeDefined();
      expect(cropSeen!.width).toBe(Math.round(0.5 * img.width));
      expect(cropSeen!.height).toBe(Math.round(0.5 * img.height));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("record builders", () => {
  it("extractionCeiling — preview iff every blocker is rights/approval", () => {
    expect(
      extractionCeiling([{ gap: "GAP-19", kind: "rights", holdsBelow: "public" }]),
    ).toBe("preview");
    expect(
      extractionCeiling([
        { gap: "GAP-19", kind: "rights", holdsBelow: "public" },
        { gap: "GAP-20", kind: "approval", holdsBelow: "public" },
      ]),
    ).toBe("preview");
    expect(
      extractionCeiling([{ gap: "GAP-19", kind: "proof", holdsBelow: "public" }]),
    ).toBe("draft");
    expect(extractionCeiling([])).toBe("preview");
  });

  it("extractedRegisterEntry copies blockers verbatim, sorted", () => {
    const entry = extractedRegisterEntry({
      emittedRel: "pages/de/assets/ext-abc123def456.webp",
      blockers: [
        { gap: "GAP-20", kind: "approval", obtainableBy: "client", holdsBelow: "public" },
        { gap: "GAP-19", kind: "rights", obtainableBy: "client", holdsBelow: "public" },
      ],
    });
    expect(entry.ceiling).toBe("preview");
    expect(entry.emitted).toBe("pages/de/assets/ext-abc123def456.webp");
    expect(entry.blockers.map((b) => b.gap)).toEqual(["GAP-19", "GAP-20"]);
  });

  it("extractedCreditRecord carries derivedFrom + sourceMaterial/rightsHolder parties", () => {
    const credit = extractedCreditRecord({
      targetId: "ext-abc123def456",
      lang: "de",
      sourceLabel: "CMD_Rose_Exclusive_booklet.pdf",
      sourceSha256: "sha256:" + "a".repeat(64),
      sourceAssetId: "AST-07",
      page: 1,
      method: "embedded-image",
      rightsHolder: "CMD Cosmetics",
    });
    expect(credit.sourceType).toBe("customer-supplied");
    expect(credit.derivedFrom?.asset).toBe("AST-07");
    expect(credit.derivedFrom?.page).toBe(1);
    expect(credit.derivedFrom?.method).toBe("embedded-image");
    expect(credit.parties.map((p) => p.kind)).toEqual(["SourceMaterial", "Organization"]);
    expect(credit.parties.map((p) => p.role)).toEqual(["sourceMaterial", "rightsHolder"]);
  });
});

describe("pngDimensions", () => {
  it("reads IHDR from a real pdftoppm render", async () => {
    const dir = workDir();
    try {
      await io.exec("pdftoppm", ["-r", "72", "-png", "-f", "1", "-l", "1", FIXTURE, join(dir, "p")]);
      const files = (await io.glob("p-*.png", { cwd: dir })).sort();
      const dims = pngDimensions(await io.readFileBytes(join(dir, files[0]!)));
      expect(dims?.width).toBe(595);
      expect(dims?.height).toBe(842);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns null on non-PNG bytes", () => {
    expect(pngDimensions(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
