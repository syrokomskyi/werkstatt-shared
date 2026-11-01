/*
<MODULE_CONTRACT>
<purpose>RFC-1345: deterministic extraction of imagery from client document
assets (booklet/catalog PDFs) — poppler (`pdfimages`, `pdftoppm`) invoked via
argument vectors through WorkspaceIO.exec (DNA-89, never shell strings). Produces
WebP bytes (encoded by an injected encoder — this package carries no native
deps), credit-sidecar records, and publication-register `assets:` entries that
inherit the source's blockers verbatim (extraction never upgrades rights).</purpose>
<non-goals>
  <item>Do not write output files — the command layer owns writes/idempotency; this module runs poppler into a caller-supplied scratch dir and returns records.</item>
  <item>Do not encode WebP itself — the caller injects a sharp-backed encoder (werkstatt-shared must not take a sharp dependency).</item>
  <item>Do not discover sources or rights — the caller resolves the document's blockers; this module only copies them into register entries.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>pdfimages -list provides num→{page,width,height} without extracting — the 400px short-side floor filters candidates before any file is produced.</item>
  <item>Emitted names are content-addressed on the WebP bytes (`ext-<sha12>.webp`) — deterministic across re-runs.</item>
  <item>Region is a normalized [x, y, width, height] page-space crop applied by page-render only; embedded-image extracts whole rasters.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1345/AMD-009: created — extractDocumentMedia + credit/register record builders.</item>
  <item>RFC-1368 review r1: pngDimensions' local PNG_SIG guard replaced by sniffMediaType — the signature table stays single-sourced.</item>
  <item>RFC-1345: carry source-derived media from client documents through the intake as extracted assets</item>
  <item>RFC-1485: sweep compass headers — shared-tail</item>
</CHANGE_SUMMARY>
*/

import { createHash } from "node:crypto";
import { basename, join } from "node:path";

import type { WorkspaceIO } from "../kernel/workspace-io.ts";
import { sniffMediaType } from "./sniff-media-type.ts";
import type { MaterialCredit } from "../schemas/material-credit.ts";
import type {
  PublicationBlocker,
  PublicationRegisterAsset,
} from "../ontology/schemas/publication-register.ts";

export type ExtractionMethod = "embedded-image" | "page-render";

/** Normalized [x, y, width, height] crop region inside a document page. */
export type ExtractionRegion = readonly [number, number, number, number];

/**
 * Caller-supplied WebP encoder (sharp-backed in engine/site). `crop` is already
 * resolved to pixels on the raster's dimensions — the encoder applies
 * sharp.extract then .webp with pinned options.
 */
export type WebpEncoder = (
  pngBytes: Uint8Array,
  crop?: { left: number; top: number; width: number; height: number },
) => Promise<Uint8Array>;

export interface DocumentMediaHint {
  page: number;
  region?: ExtractionRegion;
}

export interface ExtractDocumentInput {
  /** Absolute path of the source document (caller enforces confinement). */
  sourcePath: string;
  /** `sha256:<hex>` of the source bytes — recorded into derivedFrom. */
  sourceSha256: string;
  /** Pages to extract; empty = every page (pdfinfo supplies the count). Regions apply to page-render only. */
  hints: DocumentMediaHint[];
  method?: ExtractionMethod;
  encodeWebp: WebpEncoder;
  /** Scratch directory the poppler tools write into (caller-created). */
  workDir: string;
}

export interface ExtractedDocumentImage {
  page: number;
  /** Source raster dimensions before any region crop. */
  width: number;
  height: number;
  /** sha256:<hex> of the emitted WebP bytes. */
  sha256: string;
  /** Emitted basename — content-addressed `ext-<sha12>.webp`. */
  basename: string;
  webp: Uint8Array;
  method: ExtractionMethod;
  region?: ExtractionRegion;
}

export interface ExtractionSkip {
  page: number;
  reason: string;
}

export interface ExtractionResult {
  method: ExtractionMethod;
  extracted: ExtractedDocumentImage[];
  skipped: ExtractionSkip[];
}

/** Minimum short-side pixels for an embedded image to ship (RFC-1345). */
export const EXTRACT_MIN_SHORT_SIDE = 400;

const POPPLER_INSTALL_HINT =
  "install poppler-utils (provides pdfimages/pdftoppm) — required by RFC-1345 media extraction";

function sha256Tag(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/** Width/height of a PNG from its IHDR (bytes 16–24, big-endian). */
export function pngDimensions(png: Uint8Array): { width: number; height: number } | null {
  if (png.length < 24 || sniffMediaType(png) !== "image/png") return null;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Fail closed when poppler binaries are absent (DNA-106 — never a silent skip). */
async function requirePoppler(io: WorkspaceIO, binaries: string[]): Promise<void> {
  for (const bin of binaries) {
    try {
      const probe = await io.exec(bin, ["-v"]);
      if (probe.exitCode !== 0) throw new Error(probe.stderr || `exit ${probe.exitCode}`);
    } catch (cause) {
      throw new Error(`[asset.extract] '${bin}' is not available — ${POPPLER_INSTALL_HINT}`, {
        cause,
      });
    }
  }
}

/**
 * RFC-1345: a poppler invocation that exits non-zero is a blocking error for
 * the source (encrypted/corrupt/unreadable) — stderr carries the reason; other
 * sources may still proceed at the command layer.
 */
async function execPoppler(io: WorkspaceIO, bin: string, args: string[]): Promise<string> {
  const result = await io.exec(bin, args);
  if (result.exitCode !== 0) {
    throw new Error(
      `[asset.extract] ${bin} failed on source (exit ${result.exitCode}): ${result.stderr.trim() || "no stderr"}`,
    );
  }
  return result.stdout;
}

interface ListRow {
  page: number;
  num: number;
  type: string;
  width: number;
  height: number;
}

/** `pdfimages -list` table → rows; object-type "image" only. */
function parsePdfimagesList(stdout: string): ListRow[] {
  const rows: ListRow[] = [];
  for (const line of stdout.split("\n")) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 15) continue;
    const page = Number(cols[0]);
    const num = Number(cols[1]);
    const width = Number(cols[3]);
    const height = Number(cols[4]);
    if (!Number.isInteger(page) || !Number.isInteger(num)) continue; // header
    rows.push({ page, num, type: cols[2]!, width, height });
  }
  return rows;
}

function pixelCrop(
  region: ExtractionRegion,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  const left = Math.round(region[0] * width);
  const top = Math.round(region[1] * height);
  return {
    left,
    top,
    width: Math.max(1, Math.min(Math.round(region[2] * width), width - left)),
    height: Math.max(1, Math.min(Math.round(region[3] * height), height - top)),
  };
}

async function emit(
  input: ExtractDocumentInput,
  png: Uint8Array,
  page: number,
  dims: { width: number; height: number },
  method: ExtractionMethod,
  region: ExtractionRegion | undefined,
  seen: Set<string>,
): Promise<ExtractedDocumentImage | null> {
  const crop = region ? pixelCrop(region, dims.width, dims.height) : undefined;
  const webp = await input.encodeWebp(png, crop);
  const sha256 = sha256Tag(webp);
  if (seen.has(sha256)) return null; // exact duplicate — first occurrence wins
  seen.add(sha256);
  return {
    page,
    width: dims.width,
    height: dims.height,
    sha256,
    basename: `ext-${sha256.slice("sha256:".length, "sha256:".length + 12)}.webp`,
    webp,
    method,
    ...(region ? { region } : {}),
  };
}

async function extractEmbedded(
  io: WorkspaceIO,
  input: ExtractDocumentInput,
  pages: number[],
): Promise<ExtractionResult> {
  const listing = await execPoppler(io, "pdfimages", ["-list", input.sourcePath]);
  const rows = parsePdfimagesList(listing).filter((r) => r.type === "image");
  const seen = new Set<string>();
  const extracted: ExtractedDocumentImage[] = [];
  const skipped: ExtractionSkip[] = [];
  for (const page of pages) {
    const pageRows = rows.filter((r) => r.page === page);
    if (pageRows.length === 0) {
      skipped.push({ page, reason: "no embedded images on page" });
      continue;
    }
    const candidates = pageRows.filter(
      (r) => Math.min(r.width, r.height) >= EXTRACT_MIN_SHORT_SIDE,
    );
    if (candidates.length === 0) {
      skipped.push({
        page,
        reason: `all embedded images below ${EXTRACT_MIN_SHORT_SIDE}px short-side floor`,
      });
      continue;
    }
    const prefix = join(input.workDir, `img-p${page}`);
    await execPoppler(io, "pdfimages", [
      "-f",
      String(page),
      "-l",
      String(page),
      "-png",
      input.sourcePath,
      prefix,
    ]);
    const wanted = new Map(candidates.map((r) => [r.num, r]));
    const files = (await io.glob(`${basename(prefix)}-*.png`, { cwd: input.workDir })).sort();
    for (const rel of files) {
      const numMatch = /-(\d+)\.png$/.exec(rel);
      if (!numMatch) continue;
      const row = wanted.get(Number(numMatch[1]));
      if (!row) continue;
      const png = await io.readFileBytes(join(input.workDir, rel));
      const dims = pngDimensions(png) ?? { width: row.width, height: row.height };
      const out = await emit(input, png, page, dims, "embedded-image", undefined, seen);
      if (out) extracted.push(out);
    }
    if (!extracted.some((e) => e.page === page)) {
      skipped.push({ page, reason: "no candidate produced a file (duplicates or empty page)" });
    }
  }
  return { method: "embedded-image", extracted, skipped };
}

async function extractPageRenders(
  io: WorkspaceIO,
  input: ExtractDocumentInput,
  pages: number[],
  regions: Map<number, ExtractionRegion>,
): Promise<ExtractionResult> {
  const seen = new Set<string>();
  const extracted: ExtractedDocumentImage[] = [];
  const skipped: ExtractionSkip[] = [];
  for (const page of pages) {
    const prefix = join(input.workDir, `page-p${page}`);
    await execPoppler(io, "pdftoppm", [
      "-r",
      "200",
      "-png",
      "-f",
      String(page),
      "-l",
      String(page),
      input.sourcePath,
      prefix,
    ]);
    const files = (await io.glob(`${basename(prefix)}-*.png`, { cwd: input.workDir })).sort();
    if (files.length === 0) {
      skipped.push({ page, reason: "pdftoppm produced no render for page" });
      continue;
    }
    const png = await io.readFileBytes(join(input.workDir, files[0]!));
    const dims = pngDimensions(png);
    if (!dims) {
      skipped.push({ page, reason: "render is not a readable PNG" });
      continue;
    }
    const region = regions.get(page);
    const out = await emit(input, png, page, dims, "page-render", region, seen);
    if (out) extracted.push(out);
  }
  return { method: "page-render", extracted, skipped };
}

/**
 * Deterministic document-media extraction. Same source bytes + hints +
 * encoder → same emitted basenames; the caller's write-if-changed makes a
 * re-run a no-op (RFC-1327). Poppler failures throw (blocking per source);
 * pages that yield nothing land in `skipped` with a reason.
 */
/** `pdfinfo` → page count; blocking on unreadable/encrypted sources. */
export async function documentPageCount(io: WorkspaceIO, sourcePath: string): Promise<number> {
  const out = await execPoppler(io, "pdfinfo", [sourcePath]);
  const match = /^Pages:\s+(\d+)/m.exec(out);
  return match ? Number(match[1]) : 0;
}

export async function extractDocumentMedia(
  io: WorkspaceIO,
  input: ExtractDocumentInput,
): Promise<ExtractionResult> {
  const method = input.method ?? "embedded-image";
  const binaries = [method === "embedded-image" ? "pdfimages" : "pdftoppm"];
  if (input.hints.length === 0) binaries.push("pdfinfo"); // all-pages needs the count
  await requirePoppler(io, binaries);
  const pages =
    input.hints.length === 0
      ? Array.from({ length: await documentPageCount(io, input.sourcePath) }, (_, i) => i + 1)
      : [...new Set(input.hints.map((h) => h.page))].sort((a, b) => a - b);
  const regions = new Map(input.hints.filter((h) => h.region).map((h) => [h.page, h.region!]));
  return method === "embedded-image"
    ? extractEmbedded(io, input, pages)
    : extractPageRenders(io, input, pages, regions);
}

// ---------------------------------------------------------------------------
// Record builders (pure — the caller writes the files)
// ---------------------------------------------------------------------------

/**
 * Ceiling rule from the RFC: `preview` iff every blocker is kind
 * `rights`/`approval` (zero blockers included — nothing holds the asset back),
 * else `draft`.
 */
export function extractionCeiling(blockers: PublicationBlocker[]): "draft" | "preview" {
  return blockers.every((b) => b.kind === "rights" || b.kind === "approval") ? "preview" : "draft";
}

/**
 * RFC-1345: register `assets:` entry for one emitted file — blockers copied
 * verbatim from the source document (never upgraded, never shed).
 */
export function extractedRegisterEntry(options: {
  emittedRel: string;
  blockers: PublicationBlocker[];
}): PublicationRegisterAsset {
  return {
    ceiling: extractionCeiling(options.blockers),
    blockers: [...options.blockers].sort((a, b) => (a.gap < b.gap ? -1 : a.gap > b.gap ? 1 : 0)),
    emitted: options.emittedRel,
  };
}

/**
 * RFC-1345/RFC-0220: credit sidecar for an extracted asset —
 * `sourceType: customer-supplied`, the document named by a
 * `SourceMaterial`/`sourceMaterial` party, the manufacturer credited as
 * `Organization`/`rightsHolder` when known, `derivedFrom` provenance.
 */
export function extractedCreditRecord(options: {
  targetId: string;
  lang: string;
  sourceLabel: string;
  sourceSha256: string;
  sourceAssetId?: string;
  page?: number;
  region?: ExtractionRegion;
  method: ExtractionMethod;
  rightsHolder?: string;
}): MaterialCredit {
  const parties = [
    {
      role: "sourceMaterial" as const,
      name: options.sourceLabel,
      kind: "SourceMaterial" as const,
    },
    ...(options.rightsHolder
      ? [
          {
            role: "rightsHolder" as const,
            name: options.rightsHolder,
            kind: "Organization" as const,
          },
        ]
      : []),
  ];
  return {
    id: options.targetId,
    target: { kind: "image", id: options.targetId, domain: "pages", lang: options.lang },
    sourceType: "customer-supplied",
    status: "needs-review",
    derivedFrom: {
      asset: options.sourceAssetId ?? options.sourceLabel,
      sourceSha256: options.sourceSha256,
      ...(options.page !== undefined ? { page: options.page } : {}),
      ...(options.region
        ? { region: [...options.region] as [number, number, number, number] }
        : {}),
      method: options.method,
    },
    usageBasis: { type: "customer-supplied" },
    parties,
    license: { label: "Client-supplied document imagery — rights as stated" },
  };
}
