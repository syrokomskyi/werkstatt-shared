/*
<MODULE_CONTRACT>
<purpose>Tier 2 locale typography rules (RFC-1070). Implements 7 rules across
3 families: NUM (3), ABBR (2), APOS (2). Rules operate on TextSegment objects
produced by the text-surface extractor (RFC-1068), never on raw file bytes.
All regexes use the `u` flag and Unicode property escapes where applicable.</purpose>
<non-goals>
  <item>Do not extract text — that is text-surface.ts.</item>
  <item>Do not handle file I/O or command registration — that is the command adapter.</item>
  <item>Do not auto-fix — autofix is RFC-1072.</item>
  <item>Do not validate unicode hygiene, link text, or sentence length — RFC-1071.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1070: initial creation with 7 Tier 2 locale rules.</item>
  <item>RFC-1072: populated fix on ABBR-01, ABBR-02, APOS-01, APOS-02.</item>
</CHANGE_SUMMARY>
*/

import { finding, type TypographyFinding, type TypographyRule } from "./rules-tier1.ts";
import type { FixAction } from "./fix.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tier2LocaleRuleId = `TYPO-${"NUM" | "ABBR" | "APOS"}-${string}`;

// ---------------------------------------------------------------------------
// TYPO-NUM-01: German number with dot decimal separator (wrong: 1,234.56)
// Pattern: \d{1,3}(?:,\d{3})*\.\d{2}
// Exclusions: dates, version numbers, times, IP addresses, code spans
// ---------------------------------------------------------------------------

const NUM01_PATTERN = /\d{1,3}(?:,\d{3})*\.\d{2}/gu;
const TIME_SUFFIXES = [" Uhr", " h", " min", " sec", " s"];

function isPartOfDate(text: string, matchStart: number, matchEnd: number): boolean {
  const after = text.slice(matchEnd, matchEnd + 6);
  if (/\.\d{2,4}/.test(after)) return true;
  const before = text.slice(Math.max(0, matchStart - 6), matchStart);
  if (/\d{1,2}\.$/.test(before)) return true;
  return false;
}

function isPartOfIpAddress(text: string, matchStart: number, matchEnd: number): boolean {
  if (matchStart > 0 && /[\d.]/.test(text[matchStart - 1])) return true;
  if (matchEnd < text.length && /\d/.test(text[matchEnd])) return true;
  return false;
}

function isVersionNumber(text: string, matchStart: number): boolean {
  if (matchStart > 0) {
    const before = text[matchStart - 1];
    if (before === "v" || before === "V") return true;
  }
  return false;
}

function isTimeValue(text: string, matchEnd: number): boolean {
  const after = text.slice(matchEnd, matchEnd + 6);
  return TIME_SUFFIXES.some((suffix) => after.startsWith(suffix));
}

const num01: TypographyRule = {
  id: "TYPO-NUM-01",
  family: "NUM",
  tier: 2,
  severity: "error",
  check(segment, _ctx) {
    if (segment.locale !== "de") return [];
    const text = segment.text;
    const findings: TypographyFinding[] = [];
    for (const m of text.matchAll(NUM01_PATTERN)) {
      const matchStart = m.index;
      const matchEnd = m.index + m[0].length;
      if (isPartOfDate(text, matchStart, matchEnd)) continue;
      if (isPartOfIpAddress(text, matchStart, matchEnd)) continue;
      if (isVersionNumber(text, matchStart)) continue;
      if (isTimeValue(text, matchEnd)) continue;
      findings.push(
        finding(
          this.id,
          segment,
          m[0],
          m.index,
          `German number with dot decimal separator: "${m[0]}" — German uses comma as decimal separator (e.g. "1.234,56").`,
          "Replace the dot with a comma and the comma thousands separator with a dot.",
        ),
      );
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// TYPO-NUM-02: Ukrainian number with dot as thousands separator (wrong: 1.234,56)
// Pattern: \d{1,3}(?:\.\d{3})*,\d{2}
// Exclusions: dates (naturally excluded — dates use dots, not commas)
// ---------------------------------------------------------------------------

const NUM02_PATTERN = /\d{1,3}(?:\.\d{3})+,\d{2}/gu;

const num02: TypographyRule = {
  id: "TYPO-NUM-02",
  family: "NUM",
  tier: 2,
  severity: "error",
  check(segment, _ctx) {
    if (segment.locale !== "uk") return [];
    const text = segment.text;
    const findings: TypographyFinding[] = [];
    for (const m of text.matchAll(NUM02_PATTERN)) {
      const matchStart = m.index;
      const matchEnd = m.index + m[0].length;
      if (isPartOfIpAddress(text, matchStart, matchEnd)) continue;
      if (isVersionNumber(text, matchStart)) continue;
      findings.push(
        finding(
          this.id,
          segment,
          m[0],
          m.index,
          `Ukrainian number with dot as thousands separator: "${m[0]}" — Ukrainian uses NNBSP (U+202F) as thousands separator (e.g. "1\u202F234,56").`,
          "Replace the dot thousands separator with a narrow no-break space (U+202F).",
        ),
      );
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// TYPO-NUM-03: Space-separated thousands without NNBSP (regular space in 1 234,56)
// Pattern: \d{1,3}\x20\d{3}(?:,\d{2})?
// Exclusions: NBSP (U+00A0) and NNBSP (U+202F) are allowed; short references
// ---------------------------------------------------------------------------

const NUM03_PATTERN = /\d{1,3}\x20\d{3}(?:,\d{2})?/gu;

function isPartOfPhoneNumber(text: string, matchStart: number, _matchEnd: number): boolean {
  // Preceded by + (e.g. "+49 711")
  if (matchStart > 0 && text[matchStart - 1] === "+") return true;
  // Part of a phone number group: preceded by digits+space with + earlier in the line
  const lineStart = text.lastIndexOf("\n", matchStart - 1) + 1;
  const line = text.slice(lineStart, matchStart);
  if (/\d\s$/.test(line) && line.includes("+")) return true;
  return false;
}

const STANDARD_PREFIXES = ["EN", "ISO", "DIN", "IEC", "ETSI", "RFC", "WCAG", "W3C"];

function isPartOfStandardReference(text: string, matchStart: number): boolean {
  const lineStart = text.lastIndexOf("\n", matchStart - 1) + 1;
  const before = text.slice(lineStart, matchStart).trimEnd();
  for (const prefix of STANDARD_PREFIXES) {
    if (before.endsWith(prefix)) return true;
  }
  return false;
}

const num03: TypographyRule = {
  id: "TYPO-NUM-03",
  family: "NUM",
  tier: 2,
  severity: "error",
  check(segment, _ctx) {
    if (segment.locale !== "uk") return [];
    const text = segment.text;
    const findings: TypographyFinding[] = [];
    for (const m of text.matchAll(NUM03_PATTERN)) {
      const matchStart = m.index;
      const matchEnd = m.index + m[0].length;
      if (isPartOfIpAddress(text, matchStart, matchEnd)) continue;
      if (isPartOfPhoneNumber(text, matchStart, matchEnd)) continue;
      if (isPartOfStandardReference(text, matchStart)) continue;
      findings.push(
        finding(
          this.id,
          segment,
          m[0],
          m.index,
          `Regular space (U+0020) as thousands separator: "${m[0]}" — Ukrainian uses NNBSP (U+202F) as thousands separator.`,
          "Replace the regular space with a narrow no-break space (U+202F).",
        ),
      );
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// TYPO-ABBR-01: Known abbreviation missing required trailing period
// Algorithm: build reverse map bareForm → fullForm by stripping trailing "."
// from each abbreviation in ctx.localeDefaults.abbreviations. Search for each
// bare form as a word-boundary-delimited token. If not followed by ".", emit.
// ---------------------------------------------------------------------------

function buildBareFormMap(abbreviations: ReadonlySet<string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const abbr of abbreviations) {
    if (abbr.endsWith(".")) {
      const bare = abbr.slice(0, -1);
      if (bare.length > 0) {
        map.set(bare, abbr);
      }
    }
  }
  return map;
}

const abbr01: TypographyRule = {
  id: "TYPO-ABBR-01",
  family: "ABBR",
  tier: 2,
  severity: "error",
  check(segment, ctx) {
    const bareMap = buildBareFormMap(ctx.localeDefaults.abbreviations);
    if (bareMap.size === 0) return [];
    const text = segment.text;
    const findings: TypographyFinding[] = [];
    for (const [bare, full] of bareMap) {
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{Nd}.])${escapeRegex(bare)}(?![\\p{L}\\p{Nd}.])`,
        "gu",
      );
      for (const m of text.matchAll(pattern)) {
        const after = text[m.index + m[0].length];
        if (after === ".") continue;
        if (ctx.allowedTokens.has(bare) || ctx.allowedTokens.has(full)) continue;
        findings.push(
          finding(
            this.id,
            segment,
            m[0],
            m.index,
            `Abbreviation missing trailing period: "${m[0]}" — should be "${full}".`,
            `Add a period: "${full}".`,
            { type: "insert", at: m.index + m[0].length, text: "." } satisfies FixAction,
          ),
        );
      }
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// TYPO-ABBR-02: German abbreviation with wrong internal spacing (z.B. → z. B.)
// Pattern: z\.[Bb] · u\.[Aa] · d\.[Hh] · v\.[Ss] · u\.[Ää]
// ---------------------------------------------------------------------------

const ABBR02_PATTERNS: RegExp[] = [/z\.[Bb]/u, /u\.[Aa]/u, /d\.[Hh]/u, /v\.[Ss]/u, /u\.[Ää]/u];

const ABBR02_FIXES: Record<string, string> = {
  "z.B": "z. B",
  "z.b": "z. b",
  "u.A": "u. A",
  "u.a": "u. a",
  "d.H": "d. H",
  "d.h": "d. h",
  "v.S": "v. S",
  "v.s": "v. s",
  "u.Ä": "u. Ä",
  "u.ä": "u. ä",
};

const abbr02: TypographyRule = {
  id: "TYPO-ABBR-02",
  family: "ABBR",
  tier: 2,
  severity: "error",
  check(segment, _ctx) {
    if (segment.locale !== "de") return [];
    const text = segment.text;
    const findings: TypographyFinding[] = [];
    for (const pattern of ABBR02_PATTERNS) {
      for (const m of text.matchAll(new RegExp(pattern.source, "gu"))) {
        const matched = m[0];
        const fixed = ABBR02_FIXES[matched] ?? "";
        const fixHint = ABBR02_FIXES[matched] ?? "Add a space after the period.";
        findings.push(
          finding(
            this.id,
            segment,
            matched,
            m.index,
            `German abbreviation with wrong internal spacing: "${matched}" — should be "${fixHint}".`,
            `Add a space after the period: "${fixHint}".`,
            fixed ? ({ type: "replace", old: matched, new: fixed } satisfies FixAction) : null,
          ),
        );
      }
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// TYPO-APOS-01: Ukrainian word with curly apostrophe (U+2019) instead of straight '
// Pattern: \p{L}+\u2019\p{L}+
// Exclusions: code spans (stripped by extractor); allowedTokens
// ---------------------------------------------------------------------------

const APOS01_PATTERN = /\p{L}+\u2019\p{L}+/gu;

const apos01: TypographyRule = {
  id: "TYPO-APOS-01",
  family: "APOS",
  tier: 2,
  severity: "error",
  check(segment, ctx) {
    if (segment.locale !== "uk") return [];
    const text = segment.text;
    const findings: TypographyFinding[] = [];
    for (const m of text.matchAll(APOS01_PATTERN)) {
      const matched = m[0];
      if (ctx.allowedTokens.has(matched)) continue;
      findings.push(
        finding(
          this.id,
          segment,
          matched,
          m.index,
          `Ukrainian word with curly apostrophe (U+2019): "${matched}" — use a straight apostrophe (').`,
          "Replace the curly apostrophe with a straight apostrophe (').",
          {
            type: "replace",
            old: matched,
            new: matched.replace(/\u2019/g, "'"),
          } satisfies FixAction,
        ),
      );
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// TYPO-APOS-02: Ukrainian word with modifier letter apostrophe (U+02BC) in source
// Pattern: \p{L}+\u02BC\p{L}+
// Exclusions: code spans (stripped by extractor); allowedTokens
// ---------------------------------------------------------------------------

const APOS02_PATTERN = /\p{L}+\u02BC\p{L}+/gu;

const apos02: TypographyRule = {
  id: "TYPO-APOS-02",
  family: "APOS",
  tier: 2,
  severity: "error",
  check(segment, ctx) {
    if (segment.locale !== "uk") return [];
    const text = segment.text;
    const findings: TypographyFinding[] = [];
    for (const m of text.matchAll(APOS02_PATTERN)) {
      const matched = m[0];
      if (ctx.allowedTokens.has(matched)) continue;
      findings.push(
        finding(
          this.id,
          segment,
          matched,
          m.index,
          `Ukrainian word with modifier letter apostrophe (U+02BC): "${matched}" — use a straight apostrophe (').`,
          "Replace the modifier letter apostrophe with a straight apostrophe (').",
          {
            type: "replace",
            old: matched,
            new: matched.replace(/\u02BC/g, "'"),
          } satisfies FixAction,
        ),
      );
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// Helper: escape regex special characters in a literal string
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Export all Tier 2 locale rules
// ---------------------------------------------------------------------------

export const TIER2_LOCALE_RULES: readonly TypographyRule[] = [
  num01,
  num02,
  num03,
  abbr01,
  abbr02,
  apos01,
  apos02,
];
