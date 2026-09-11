/*
<MODULE_CONTRACT>
<purpose>Unit tests for Tier 3 advisory typography rules (RFC-1071). Tests cover
all 5 rules: TYPO-UNICODE-01..02, TYPO-LINK-01..02, TYPO-SENT-01. Each rule
is tested for positive detection, negative (no finding), and key exclusions.</purpose>
<non-goals>
  <item>Do not test text-surface extraction — that is text-surface.test.ts.</item>
  <item>Do not test command adapter — that is typography.test.ts in werkstatt-site.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1071: initial creation with unit tests for 5 Tier 3 advisory rules.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { TIER3_ADVISORY_RULES, type Tier3AdvisoryRuleId } from "./rules-tier3-advisory.ts";
import type { TextSegment } from "./text-surface.ts";
import type { TypographyContext, TypographyRule, TypographyFinding } from "./rules-tier1.ts";
import { createTypographyContext } from "./rules-tier1.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSegment(
  text: string,
  locale: string,
  source: "frontmatter" | "body" = "body",
  raw?: string,
): TextSegment {
  return {
    file: `test.${locale}.md`,
    line: 1,
    path: "$body",
    source,
    text,
    raw: raw ?? text,
    isTableRow: false,
    locale,
  };
}

function makeCtx(
  locale: string,
  allowedTokens: ReadonlySet<string> = new Set(),
): TypographyContext {
  return createTypographyContext(locale, allowedTokens);
}

function runRule(
  ruleId: Tier3AdvisoryRuleId,
  text: string,
  locale: string,
  source: "frontmatter" | "body" = "body",
  raw?: string,
): TypographyFinding[] {
  const rule = TIER3_ADVISORY_RULES.find((r) => r.id === ruleId) as TypographyRule;
  const segment = makeSegment(text, locale, source, raw);
  const ctx = makeCtx(locale);
  return rule.check(segment, ctx);
}

function expectFinding(
  ruleId: Tier3AdvisoryRuleId,
  text: string,
  locale: string,
  raw?: string,
): void {
  const findings = runRule(ruleId, text, locale, "body", raw);
  expect(findings.length).toBeGreaterThanOrEqual(1);
  expect(findings[0].ruleId).toBe(ruleId);
}

function expectNoFinding(
  ruleId: Tier3AdvisoryRuleId,
  text: string,
  locale: string,
  source: "frontmatter" | "body" = "body",
  raw?: string,
): void {
  const findings = runRule(ruleId, text, locale, source, raw);
  expect(findings).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// Verify all rules have tier 3 and severity warning
// ---------------------------------------------------------------------------

describe("TIER3_ADVISORY_RULES — metadata", () => {
  it("has 5 rules", () => {
    expect(TIER3_ADVISORY_RULES).toHaveLength(5);
  });

  it("all rules have tier 3 and severity warning", () => {
    for (const rule of TIER3_ADVISORY_RULES) {
      expect(rule.tier).toBe(3);
      expect(rule.severity).toBe("warning");
    }
  });

  it("has expected rule IDs", () => {
    const ids = TIER3_ADVISORY_RULES.map((r) => r.id);
    expect(ids).toContain("TYPO-UNICODE-01");
    expect(ids).toContain("TYPO-UNICODE-02");
    expect(ids).toContain("TYPO-LINK-01");
    expect(ids).toContain("TYPO-LINK-02");
    expect(ids).toContain("TYPO-SENT-01");
  });
});

// ---------------------------------------------------------------------------
// TYPO-UNICODE-01: Zero-width characters
// ---------------------------------------------------------------------------

describe("TYPO-UNICODE-01 — zero-width characters", () => {
  it("detects U+200B (zero-width space)", () => {
    expectFinding("TYPO-UNICODE-01", "Hello\u200BWorld", "en");
  });

  it("detects U+200C (zero-width non-joiner)", () => {
    expectFinding("TYPO-UNICODE-01", "Hello\u200CWorld", "en");
  });

  it("detects U+200D (zero-width joiner)", () => {
    expectFinding("TYPO-UNICODE-01", "Hello\u200DWorld", "en");
  });

  it("detects U+FEFF (BOM)", () => {
    expectFinding("TYPO-UNICODE-01", "Hello\uFEFFWorld", "en");
  });

  it("does not flag clean text", () => {
    expectNoFinding("TYPO-UNICODE-01", "Hello World", "en");
  });

  it("reports correct character name in message", () => {
    const findings = runRule("TYPO-UNICODE-01", "Hello\u200BWorld", "en");
    expect(findings[0].message).toContain("U+200B");
  });
});

// ---------------------------------------------------------------------------
// TYPO-UNICODE-02: Soft hyphen
// ---------------------------------------------------------------------------

describe("TYPO-UNICODE-02 — soft hyphen", () => {
  it("detects U+00AD (soft hyphen)", () => {
    expectFinding("TYPO-UNICODE-02", "Hello\u00ADWorld", "en");
  });

  it("does not flag clean text", () => {
    expectNoFinding("TYPO-UNICODE-02", "Hello World", "en");
  });

  it("does not flag HTML entity &shy; (ASCII, not U+00AD)", () => {
    expectNoFinding("TYPO-UNICODE-02", "Hello&shy;World", "en");
  });
});

// ---------------------------------------------------------------------------
// TYPO-LINK-01: Link text is a bare URL
// ---------------------------------------------------------------------------

describe("TYPO-LINK-01 — bare URL link text", () => {
  it("detects [https://example.com](https://example.com)", () => {
    const raw = "[https://example.com](https://example.com)";
    const text = "[https://example.com]"; // extractor strips ](url)
    expectFinding("TYPO-LINK-01", text, "en", raw);
  });

  it("detects [http://example.com](http://example.com)", () => {
    const raw = "[http://example.com](http://example.com)";
    const text = "[http://example.com]";
    expectFinding("TYPO-LINK-01", text, "en", raw);
  });

  it("does not flag descriptive link text", () => {
    const raw = "[Learn more](https://example.com)";
    const text = "[Learn more]";
    expectNoFinding("TYPO-LINK-01", text, "en", "body", raw);
  });

  it("does not flag frontmatter segments", () => {
    const raw = "[https://example.com](https://example.com)";
    const text = "[https://example.com]";
    expectNoFinding("TYPO-LINK-01", text, "en", "frontmatter", raw);
  });

  it("does not flag bare URLs inside inline code spans", () => {
    const raw = "`[https://example.com](https://example.com)`";
    const text = "\uE002"; // extractor replaces code spans with placeholder
    expectNoFinding("TYPO-LINK-01", text, "en", "body", raw);
  });
});

// ---------------------------------------------------------------------------
// TYPO-LINK-02: Link text is a generic phrase
// ---------------------------------------------------------------------------

describe("TYPO-LINK-02 — generic link text", () => {
  it("detects 'click here'", () => {
    const raw = "[click here](https://example.com)";
    const text = "[click here]";
    expectFinding("TYPO-LINK-02", text, "en", raw);
  });

  it("detects 'hier klicken'", () => {
    const raw = "[hier klicken](https://example.com)";
    const text = "[hier klicken]";
    expectFinding("TYPO-LINK-02", text, "de", raw);
  });

  it("detects 'тут'", () => {
    const raw = "[тут](https://example.com)";
    const text = "[тут]";
    expectFinding("TYPO-LINK-02", text, "uk", raw);
  });

  it("detects 'here' case-insensitive", () => {
    const raw = "[HERE](https://example.com)";
    const text = "[HERE]";
    expectFinding("TYPO-LINK-02", text, "en", raw);
  });

  it("detects 'hier' (German)", () => {
    const raw = "[hier](https://example.com)";
    const text = "[hier]";
    expectFinding("TYPO-LINK-02", text, "de", raw);
  });

  it("does not flag descriptive link text", () => {
    const raw = "[Learn more about our services](https://example.com)";
    const text = "[Learn more about our services]";
    expectNoFinding("TYPO-LINK-02", text, "en", "body", raw);
  });

  it("does not flag 'here' within a longer phrase", () => {
    const raw = "[See here for details](https://example.com)";
    const text = "[See here for details]";
    expectNoFinding("TYPO-LINK-02", text, "en", "body", raw);
  });

  it("does not flag frontmatter segments", () => {
    const raw = "[click here](https://example.com)";
    const text = "[click here]";
    expectNoFinding("TYPO-LINK-02", text, "en", "frontmatter", raw);
  });

  it("does not flag generic phrases inside inline code spans", () => {
    const raw = "`[click here](https://example.com)`";
    const text = "\uE002";
    expectNoFinding("TYPO-LINK-02", text, "en", "body", raw);
  });
});

// ---------------------------------------------------------------------------
// TYPO-SENT-01: Sentence longer than 40 words
// ---------------------------------------------------------------------------

function makeLongSentence(wordCount: number): string {
  return Array.from({ length: wordCount }, (_, i) => `word${i}`).join(" ") + ".";
}

describe("TYPO-SENT-01 — long sentence", () => {
  it("detects a sentence with 41 words", () => {
    const text = makeLongSentence(41);
    expectFinding("TYPO-SENT-01", text, "en");
  });

  it("does not flag a sentence with 40 words", () => {
    const text = makeLongSentence(40);
    expectNoFinding("TYPO-SENT-01", text, "en");
  });

  it("does not flag a short sentence", () => {
    expectNoFinding("TYPO-SENT-01", "This is a short sentence.", "en");
  });

  it("does not flag frontmatter segments", () => {
    const text = makeLongSentence(41);
    expectNoFinding("TYPO-SENT-01", text, "en", "frontmatter");
  });

  it("counts words correctly with Unicode punctuation", () => {
    const words = Array.from({ length: 41 }, (_, i) => `word${i}`).join(", ");
    const text = words + ".";
    expectFinding("TYPO-SENT-01", text, "en");
  });
});
