/*
<MODULE_CONTRACT>
<purpose>
  [RFC-0194] Page Substance Score: a deterministic build-time measure of whether a generated page
  is substantively unique, not a near-duplicate template with a swapped noun. Composed from four
  components — independent data blocks, unique-vs-family token ratio, signal blocks, and internal
  link diversity. A page below the Blueprint's substanceMin is forced to noindex regardless of how
  many records matched it. Pure — no I/O, no LLM.
</purpose>
<non-goals>
  <item>Do not call an LLM or the network — the gate must be deterministic.</item>
  <item>Do not mutate page content to raise a score.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0383: generalize the link-target walker into exported `extractLinkTargets` (typed LinkTarget set); `countLinkTargets` delegates — scoring unchanged.</item>
  <item>RFC-0194: initial scorer.</item>
  <item>RFC-0274: walk nested visible props so substance/duplicate checks see rendered semantic text.</item>
  <item>RFC-1257: structured CtaTarget + scenario-plumbed contact links</item>
</CHANGE_SUMMARY>
*/

import type { PageEntry } from "./types.ts";

export interface SubstanceComponents {
  independentBlocks: number;
  uniqueTokenRatio: number; // 0..1
  signalBlocks: number;
  linkDiversity: number;
}

export interface SubstanceScore {
  value: number; // 0..100
  components: SubstanceComponents;
}

/** Lowercase word tokens of length > 3 (cheap, deterministic, language-agnostic). */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-zà-ÿ0-9]+/gi) ?? []).filter((t) => t.length > 3);
}

const NON_VISIBLE_TEXT_KEYS = new Set([
  "id",
  "slug",
  "pageId",
  "href",
  "url",
  "src",
  "source",
  "image",
  "imageName",
  "leadImage",
  "backgroundImage",
  "poster",
  "photo",
  "video",
  "variant",
  "kind",
  "type",
  "use",
]);

function collectVisibleText(value: unknown, key = ""): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (NON_VISIBLE_TEXT_KEYS.has(key)) return [];
    if (/^(\/|https?:|mailto:|tel:)/i.test(trimmed)) return [];
    return [trimmed];
  }
  if (Array.isArray(value)) return value.flatMap((item) => collectVisibleText(item, key));
  if (value && typeof value === "object") {
    const out: string[] = [];
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      out.push(...collectVisibleText(childValue, childKey));
    }
    return out;
  }
  return [];
}

/** Concatenate a page's rendered semantic text, including nested visible block props. */
export function pageText(page: PageEntry): string {
  const parts: string[] = [page.title, page.description].filter(Boolean);
  for (const block of page.blocks) {
    parts.push(...collectVisibleText(block.props));
  }
  return parts.join(" ");
}

/** token → number of pages whose token set contains it. */
export function buildTokenDocFreq(pages: readonly PageEntry[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set(tokenize(pageText(page)));
    for (const token of seen) freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  return freq;
}

/**
 * A distinct link target extracted from a page's block props (RFC-0383).
 * `route` is a relative `/…` internal path; `absolute` is an `https?://` URL whose
 * host cannot be classified at this layer (consumers resolve or drop it);
 * `pageId` is an RFC-1257 structured CtaTarget node destination.
 */
export type LinkTarget =
  | { kind: "route"; href: string }
  | { kind: "absolute"; href: string }
  | { kind: "pageId"; pageId: string };

/**
 * Extract the distinct link targets referenced in a page's block props. Walks
 * nested arrays/objects; string values matching `/^(\/|https?:)/` classify as
 * route or absolute targets, and RFC-1257 `CtaTarget` nodes
 * (`{kind:"internal", pageId}`) count their pageId and do not recurse. Dedup is
 * by canonical `kind:value` key — identical raw targets collapse to one entry.
 */
export function extractLinkTargets(page: PageEntry): Set<LinkTarget> {
  const targets = new Map<string, LinkTarget>();
  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      if (/^\//.test(value)) targets.set(`route:${value}`, { kind: "route", href: value });
      else if (/^https?:/.test(value)) {
        targets.set(`absolute:${value}`, { kind: "absolute", href: value });
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      // RFC-1257: structured CtaTarget nodes — an internal target counts its
      // pageId as a link destination; external hrefs fall through to the
      // string visitor below.
      if (record.kind === "internal" && typeof record.pageId === "string") {
        targets.set(`pageId:${record.pageId}`, { kind: "pageId", pageId: record.pageId });
        return;
      }
      for (const v of Object.values(record)) visit(v);
    }
  };
  for (const block of page.blocks) visit(block.props);
  return new Set(targets.values());
}

/** Count distinct internal-link targets referenced in a page's block props. */
function countLinkTargets(page: PageEntry): number {
  return extractLinkTargets(page).size;
}

/**
 * Score a page's substance. `docFreq`/`totalPages` come from the family baseline (buildTokenDocFreq);
 * a token is "unique" when it appears in at most ceil(totalPages * 0.5) pages. `signalBlockIds` are
 * block `type`s the Blueprint marks as substance-bearing; when omitted, any block with a non-empty
 * `lead`/`body` counts as a signal.
 */
export function scoreSubstance(
  page: PageEntry,
  ctx: { docFreq: Map<string, number>; totalPages: number; signalBlockIds?: string[] },
): SubstanceScore {
  const independentBlocks = page.blocks.length;

  const tokens = tokenize(pageText(page));
  const distinct = new Set(tokens);
  const uniqueThreshold = Math.max(1, Math.ceil(ctx.totalPages * 0.5));
  let uniqueCount = 0;
  for (const token of distinct) {
    if ((ctx.docFreq.get(token) ?? 0) <= uniqueThreshold) uniqueCount += 1;
  }
  const uniqueTokenRatio = distinct.size === 0 ? 0 : uniqueCount / distinct.size;

  const signalSet = ctx.signalBlockIds ? new Set(ctx.signalBlockIds) : null;
  let signalBlocks = 0;
  for (const block of page.blocks) {
    const props = (block.props ?? {}) as Record<string, unknown>;
    const isSignal = signalSet
      ? signalSet.has(block.type ?? block.use ?? "")
      : collectVisibleText(props).join(" ").length > 40;
    if (isSignal) signalBlocks += 1;
  }

  const linkDiversity = countLinkTargets(page);

  const value = Math.round(
    Math.min(100, independentBlocks * 12) * 0.3 +
      uniqueTokenRatio * 100 * 0.4 +
      Math.min(100, signalBlocks * 18) * 0.2 +
      Math.min(100, linkDiversity * 20) * 0.1,
  );

  return {
    value,
    components: { independentBlocks, uniqueTokenRatio, signalBlocks, linkDiversity },
  };
}
