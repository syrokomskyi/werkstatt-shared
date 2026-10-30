/*
<MODULE_CONTRACT>
<purpose>
Unit tests for fixpbt — fix.pbt covering Fix engine — property-based tests (RFC-1072, DNA-101).
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the fix.pbt suite's contract for test-file scaffold coverage.</item>
  <item>RFC-1446: enforce uzbek apostrophe orthography and russian heading case</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { applyFixes, FIXABLE_RULE_IDS, isFixable } from "./fix.ts";
import {
  TIER1_RULES,
  createTypographyContext,
  type TypographyFinding,
  type TypographyRule,
} from "./rules-tier1.ts";
import { TIER2_LOCALE_RULES } from "./rules-tier2-locale.ts";
import type { TextSegment } from "./text-surface.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSegment(text: string, locale = "de"): TextSegment {
  return {
    file: "test.md",
    line: 1,
    path: "$body",
    source: "body",
    text,
    raw: text,
    isTableRow: false,
    locale,
  };
}

const ALL_FIXABLE_RULES: readonly TypographyRule[] = [...TIER1_RULES, ...TIER2_LOCALE_RULES].filter(
  (rule) => isFixable(rule.id),
);

function runFixableRules(text: string, locale: string): TypographyFinding[] {
  const segment = makeSegment(text, locale);
  const ctx = createTypographyContext(locale, new Set());
  const findings: TypographyFinding[] = [];
  for (const rule of ALL_FIXABLE_RULES) {
    if (rule.id === "TYPO-ABBR-02" && locale !== "de") continue;
    if ((rule.id === "TYPO-APOS-01" || rule.id === "TYPO-APOS-02") && locale !== "uk") continue;
    if ((rule.id === "TYPO-APOS-03" || rule.id === "TYPO-APOS-04") && locale !== "uz") continue;
    findings.push(...rule.check(segment, ctx));
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Property tests (DNA-101: idempotency)
// ---------------------------------------------------------------------------

describe("Fix engine — property-based tests (RFC-1072, DNA-101)", () => {
  it("FIXABLE_RULE_IDS contains exactly 10 rule IDs", () => {
    expect(FIXABLE_RULE_IDS).toHaveLength(10);
    expect(FIXABLE_RULE_IDS).toContain("TYPO-PUNCT-01");
    expect(FIXABLE_RULE_IDS).toContain("TYPO-SPACE-01");
    expect(FIXABLE_RULE_IDS).toContain("TYPO-SPACE-02");
    expect(FIXABLE_RULE_IDS).toContain("TYPO-APOS-01");
    expect(FIXABLE_RULE_IDS).toContain("TYPO-APOS-02");
    expect(FIXABLE_RULE_IDS).toContain("TYPO-APOS-03");
    expect(FIXABLE_RULE_IDS).toContain("TYPO-APOS-04");
    expect(FIXABLE_RULE_IDS).toContain("TYPO-ABBR-01");
    expect(FIXABLE_RULE_IDS).toContain("TYPO-ABBR-02");
    expect(FIXABLE_RULE_IDS).toContain("TYPO-HEAD-04");
  });

  it("isFixable returns true only for whitelisted rules", () => {
    for (const id of FIXABLE_RULE_IDS) {
      expect(isFixable(id)).toBe(true);
    }
    expect(isFixable("TYPO-PUNCT-02")).toBe(false);
    expect(isFixable("TYPO-CASE-01")).toBe(false);
    expect(isFixable("TYPO-UNICODE-01")).toBe(false);
  });

  it("applyFixes is idempotent: fixing an already-fixed text produces no new fixes", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant("Hello  world"), // SPACE-01
          fc.constant("Hello   "), // SPACE-02
          fc.constant("Hello,, world"), // PUNCT-01
          fc.constant("Hello:: world"), // PUNCT-01
          fc.constant("z.B. Hallo"), // ABBR-02 (de)
          fc.constant("z. B. Hallo"), // already fixed ABBR-02
        ),
        (text) => {
          const findings1 = runFixableRules(text, "de");
          const { fixedSegments } = applyFixes(findings1, createTypographyContext("de", new Set()));
          const fixedText = fixedSegments.get("test.md:1:$body") ?? text;

          // Running fixable rules on the fixed text should produce zero fixable findings
          const findings2 = runFixableRules(fixedText, "de");
          const fixableFindings2 = findings2.filter((f) => f.fix !== null);
          expect(fixableFindings2).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("applyFixes is idempotent for Uzbek apostrophe fixes (RFC-1446 AC-4)", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant("to'g'ri"), // APOS-03: oʻ/gʻ spots
          fc.constant("toʼgʼridan"), // APOS-03 with U+02BC source
          fc.constant("ma'lumot"), // APOS-04: glottal stop
          fc.constant("O'zbekistonda ma'lumot to'g'ri"), // mixed spots
          fc.constant("mo'jaz"), // seed word — fixes to moʼjaz, not moʻjaz
        ),
        (text) => {
          const findings1 = runFixableRules(text, "uz");
          const { fixedSegments } = applyFixes(findings1, createTypographyContext("uz", new Set()));
          const fixedText = fixedSegments.get("test.md:1:$body") ?? text;

          // Re-running fixable rules on the fixed text yields zero fixable findings.
          const findings2 = runFixableRules(fixedText, "uz");
          expect(findings2.filter((f) => f.fix !== null)).toHaveLength(0);

          // Nothing outside the apostrophes changed — strip all apostrophe
          // shapes from both sides and the skeleton must be identical.
          const strip = (s: string) => s.replace(/['‘’ʼʻ`]/g, "");
          expect(strip(fixedText)).toBe(strip(text));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("applyFixes with no fixable findings returns empty map", () => {
    const findings: TypographyFinding[] = [];
    const ctx = createTypographyContext("de", new Set());
    const result = applyFixes(findings, ctx);
    expect(result.fixedSegments.size).toBe(0);
    expect(result.fixCount).toBe(0);
  });

  it("applyFixes skips findings with fix: null", () => {
    const segment = makeSegment("Hello world", "de");
    const findings: TypographyFinding[] = [
      {
        ruleId: "TYPO-PUNCT-02",
        segment,
        match: "..",
        column: 5,
        message: "test",
        fixHint: "test",
        fix: null,
      },
    ];
    const ctx = createTypographyContext("de", new Set());
    const result = applyFixes(findings, ctx);
    expect(result.fixedSegments.size).toBe(0);
    expect(result.fixCount).toBe(0);
  });

  it("replace action replaces the match at the given column", () => {
    const segment = makeSegment("Hello,, world", "de");
    const findings: TypographyFinding[] = [
      {
        ruleId: "TYPO-PUNCT-01",
        segment,
        match: ",,",
        column: 5,
        message: "test",
        fixHint: "test",
        fix: { type: "replace", old: ",,", new: "," },
      },
    ];
    const ctx = createTypographyContext("de", new Set());
    const result = applyFixes(findings, ctx);
    const fixed = result.fixedSegments.get("test.md:1:$body");
    expect(fixed).toBe("Hello, world");
  });

  it("insert action inserts text at the specified position", () => {
    const segment = makeSegment("zB Hallo", "de");
    const findings: TypographyFinding[] = [
      {
        ruleId: "TYPO-ABBR-01",
        segment,
        match: "zB",
        column: 0,
        message: "test",
        fixHint: "test",
        fix: { type: "insert", at: 2, text: "." },
      },
    ];
    const ctx = createTypographyContext("de", new Set());
    const result = applyFixes(findings, ctx);
    const fixed = result.fixedSegments.get("test.md:1:$body");
    expect(fixed).toBe("zB. Hallo");
  });

  it("delete action removes characters at the specified position", () => {
    const segment = makeSegment("Hello   ", "de");
    const findings: TypographyFinding[] = [
      {
        ruleId: "TYPO-SPACE-02",
        segment,
        match: "   ",
        column: 5,
        message: "test",
        fixHint: "test",
        fix: { type: "delete", at: 5, length: 3 },
      },
    ];
    const ctx = createTypographyContext("de", new Set());
    const result = applyFixes(findings, ctx);
    const fixed = result.fixedSegments.get("test.md:1:$body");
    expect(fixed).toBe("Hello");
  });

  it("multiple fixes in the same segment are applied correctly (right-to-left)", () => {
    const segment = makeSegment("Hello,,  world", "de");
    const findings: TypographyFinding[] = [
      {
        ruleId: "TYPO-PUNCT-01",
        segment,
        match: ",,",
        column: 5,
        message: "test",
        fixHint: "test",
        fix: { type: "replace", old: ",,", new: "," },
      },
      {
        ruleId: "TYPO-SPACE-01",
        segment,
        match: "  w",
        column: 7,
        message: "test",
        fixHint: "test",
        fix: { type: "replace", old: "  w", new: " w" },
      },
    ];
    const ctx = createTypographyContext("de", new Set());
    const result = applyFixes(findings, ctx);
    const fixed = result.fixedSegments.get("test.md:1:$body");
    expect(fixed).toBe("Hello, world");
  });
});
