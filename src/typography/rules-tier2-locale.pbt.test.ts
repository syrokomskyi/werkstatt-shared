/*
<MODULE_CONTRACT>
<purpose>Property-based tests for Tier 2 locale typography rules (RFC-1070).
Tests algebraic properties of the pure rule functions using fast-check (DNA-101).</purpose>
<non-goals>
  <item>Do not test specific edge cases — those are in rules-tier2-locale.test.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1070: initial creation with property-based tests for Tier 2 locale rules.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { TIER2_LOCALE_RULES } from "./rules-tier2-locale.ts";
import type { TextSegment } from "./text-surface.ts";
import {
  createTypographyContext,
  type TypographyContext,
  type TypographyRule,
  type TypographyFinding,
} from "./rules-tier1.ts";
import { fcAssert, composeWord, safeText } from "../pbt/index.ts";

function makeSegment(text: string, locale: string): TextSegment {
  return {
    file: `test.${locale}.md`,
    line: 1,
    path: "$body",
    source: "body",
    text,
    raw: text,
    isTableRow: false,
    locale,
  };
}

function getRule(ruleId: string): TypographyRule {
  const rule = TIER2_LOCALE_RULES.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Rule ${ruleId} not found`);
  return rule;
}

function runRule(
  ruleId: string,
  text: string,
  locale: string,
  ctx?: TypographyContext,
): TypographyFinding[] {
  const rule = getRule(ruleId);
  const segment = makeSegment(text, locale);
  return rule.check(segment, ctx ?? createTypographyContext(locale, new Set()));
}

// Use bounded-length strings for fast generation (RFC-1070 PBT helpers)
const FAST_TEXT = safeText(80);

// ---------------------------------------------------------------------------
// Properties for locale-specific rules: non-matching locale → zero findings
// ---------------------------------------------------------------------------

describe("PBT: locale-specific rules never fire on wrong locale", () => {
  it("TYPO-NUM-01 never fires on non-de locale", () => {
    fcAssert(
      fc.property(FAST_TEXT, fc.constantFrom("uk", "en", "fr", "es"), (text, locale) => {
        expect(runRule("TYPO-NUM-01", text, locale)).toHaveLength(0);
      }),
    );
  });

  it("TYPO-NUM-02 never fires on non-uk locale", () => {
    fcAssert(
      fc.property(FAST_TEXT, fc.constantFrom("de", "en", "fr", "es"), (text, locale) => {
        expect(runRule("TYPO-NUM-02", text, locale)).toHaveLength(0);
      }),
    );
  });

  it("TYPO-NUM-03 never fires on non-uk locale", () => {
    fcAssert(
      fc.property(FAST_TEXT, fc.constantFrom("de", "en", "fr", "es"), (text, locale) => {
        expect(runRule("TYPO-NUM-03", text, locale)).toHaveLength(0);
      }),
    );
  });

  it("TYPO-ABBR-02 never fires on non-de locale", () => {
    fcAssert(
      fc.property(FAST_TEXT, fc.constantFrom("uk", "en", "fr", "es"), (text, locale) => {
        expect(runRule("TYPO-ABBR-02", text, locale)).toHaveLength(0);
      }),
    );
  });

  it("TYPO-APOS-01 never fires on non-uk locale", () => {
    fcAssert(
      fc.property(FAST_TEXT, fc.constantFrom("de", "en", "fr", "es"), (text, locale) => {
        expect(runRule("TYPO-APOS-01", text, locale)).toHaveLength(0);
      }),
    );
  });

  it("TYPO-APOS-02 never fires on non-uk locale", () => {
    fcAssert(
      fc.property(FAST_TEXT, fc.constantFrom("de", "en", "fr", "es"), (text, locale) => {
        expect(runRule("TYPO-APOS-02", text, locale)).toHaveLength(0);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Properties: text without target patterns → zero findings
// Uses conditional inside property body instead of filter (much faster)
// ---------------------------------------------------------------------------

describe("PBT: text without target patterns yields zero findings", () => {
  it("TYPO-NUM-01: text without comma-thousands.dot-decimal → zero findings", () => {
    fcAssert(
      fc.property(FAST_TEXT, (text) => {
        if (/\d{1,3}(?:,\d{3})*\.\d{2}/.test(text)) return; // skip if pattern present
        expect(runRule("TYPO-NUM-01", text, "de")).toHaveLength(0);
      }),
    );
  });

  it("TYPO-NUM-02: text without dot-thousands.comma-decimal → zero findings", () => {
    fcAssert(
      fc.property(FAST_TEXT, (text) => {
        if (/\d{1,3}(?:\.\d{3})*,\d{2}/.test(text)) return;
        expect(runRule("TYPO-NUM-02", text, "uk")).toHaveLength(0);
      }),
    );
  });

  it("TYPO-APOS-01: text without U+2019 → zero findings", () => {
    fcAssert(
      fc.property(FAST_TEXT, (text) => {
        if (text.includes("\u2019")) return;
        expect(runRule("TYPO-APOS-01", text, "uk")).toHaveLength(0);
      }),
    );
  });

  it("TYPO-APOS-02: text without U+02BC → zero findings", () => {
    fcAssert(
      fc.property(FAST_TEXT, (text) => {
        if (text.includes("\u02BC")) return;
        expect(runRule("TYPO-APOS-02", text, "uk")).toHaveLength(0);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Properties: allowedTokens exclusion is stable
// Constructs strings guaranteed to contain the pattern by composition
// ---------------------------------------------------------------------------

// Compose: letter + "'" + letter using efficient letterString (no filter)
const STRAIGHT_APOS_WORD = composeWord("'");

describe("PBT: allowedTokens exclusion", () => {
  it("TYPO-APOS-01: curly-apostrophe words in allowedTokens are never flagged", () => {
    fcAssert(
      fc.property(STRAIGHT_APOS_WORD, (word) => {
        const curlyWord = word.replace(/'/g, "\u2019");
        const match = curlyWord.match(/\p{L}+\u2019\p{L}+/u);
        if (!match) return;
        const allowedToken = match[0];
        const ctx = createTypographyContext("uk", new Set([allowedToken]));
        expect(runRule("TYPO-APOS-01", curlyWord, "uk", ctx)).toHaveLength(0);
      }),
    );
  });

  it("TYPO-APOS-02: modifier-apostrophe words in allowedTokens are never flagged", () => {
    fcAssert(
      fc.property(STRAIGHT_APOS_WORD, (word) => {
        const modWord = word.replace(/'/g, "\u02BC");
        const match = modWord.match(/\p{L}+\u02BC\p{L}+/u);
        if (!match) return;
        const allowedToken = match[0];
        const ctx = createTypographyContext("uk", new Set([allowedToken]));
        expect(runRule("TYPO-APOS-02", modWord, "uk", ctx)).toHaveLength(0);
      }),
    );
  });
});
