/*
<MODULE_CONTRACT>
<purpose>Unit tests for Tier 2 locale typography rules (RFC-1070). Tests cover
all 7 rules: TYPO-NUM-01..03, TYPO-ABBR-01..02, TYPO-APOS-01..02. Each rule
is tested for positive detection, negative (no finding), and key exclusions.</purpose>
<non-goals>
  <item>Do not test text-surface extraction — that is text-surface.test.ts.</item>
  <item>Do not test command adapter — that is typography.test.ts in werkstatt-site.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1070: initial creation with unit tests for 7 Tier 2 locale rules.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { TIER2_LOCALE_RULES, type Tier2LocaleRuleId } from "./rules-tier2-locale.ts";
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
): TextSegment {
  return {
    file: `test.${locale}.md`,
    line: 1,
    path: "$body",
    source,
    text,
    raw: text,
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
  ruleId: Tier2LocaleRuleId,
  text: string,
  locale: string,
  source: "frontmatter" | "body" = "body",
): TypographyFinding[] {
  const rule = TIER2_LOCALE_RULES.find((r) => r.id === ruleId) as TypographyRule;
  const segment = makeSegment(text, locale, source);
  const ctx = makeCtx(locale);
  return rule.check(segment, ctx);
}

function expectFinding(ruleId: Tier2LocaleRuleId, text: string, locale: string): void {
  const findings = runRule(ruleId, text, locale);
  expect(findings.length).toBeGreaterThanOrEqual(1);
  expect(findings[0].ruleId).toBe(ruleId);
}

function expectNoFinding(ruleId: Tier2LocaleRuleId, text: string, locale: string): void {
  const findings = runRule(ruleId, text, locale);
  expect(findings).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// TYPO-NUM-01: German number with dot decimal separator
// ---------------------------------------------------------------------------

describe("TYPO-NUM-01 — German dot decimal", () => {
  it("detects 1,234.56 in German text", () => {
    expectFinding("TYPO-NUM-01", "Der Preis betraegt 1,234.56 Euro.", "de");
  });

  it("does not fire on correct German format 1.234,56", () => {
    expectNoFinding("TYPO-NUM-01", "Der Preis betraegt 1.234,56 Euro.", "de");
  });

  it("does not fire on dates (12.04.2026)", () => {
    expectNoFinding("TYPO-NUM-01", "Am 12.04.2026 fand das Treffen statt.", "de");
  });

  it("does not fire on version numbers (v1.23)", () => {
    expectNoFinding("TYPO-NUM-01", "Wir nutzen v1.23 des Tools.", "de");
  });

  it("does not fire on time values (10.30 Uhr)", () => {
    expectNoFinding("TYPO-NUM-01", "Das Treningen beginnt um 10.30 Uhr.", "de");
  });

  it("does not fire on Ukrainian text", () => {
    expectNoFinding("TYPO-NUM-01", "Цiна 1,234.56 евро.", "uk");
  });

  it("does not fire on English text", () => {
    expectNoFinding("TYPO-NUM-01", "The price is 1,234.56 dollars.", "en");
  });
});

// ---------------------------------------------------------------------------
// TYPO-NUM-02: Ukrainian number with dot as thousands separator
// ---------------------------------------------------------------------------

describe("TYPO-NUM-02 — Ukrainian dot thousands", () => {
  it("detects 1.234,56 in Ukrainian text", () => {
    expectFinding("TYPO-NUM-02", "Цiна 1.234,56 евро.", "uk");
  });

  it("does not fire on correct Ukrainian format with NNBSP", () => {
    expectNoFinding("TYPO-NUM-02", "Цiна 1\u202F234,56 евро.", "uk");
  });

  it("does not fire on German text", () => {
    expectNoFinding("TYPO-NUM-02", "Der Preis betraegt 1.234,56 Euro.", "de");
  });

  it("does not fire on dates", () => {
    expectNoFinding("TYPO-NUM-02", "12.04.2026", "uk");
  });
});

// ---------------------------------------------------------------------------
// TYPO-NUM-03: Regular space as thousands separator in Ukrainian
// ---------------------------------------------------------------------------

describe("TYPO-NUM-03 — Regular space thousands in Ukrainian", () => {
  it("detects 1 234,56 with regular space in Ukrainian text", () => {
    const text = "Цiна 1 234,56 евро.";
    expectFinding("TYPO-NUM-03", text, "uk");
  });

  it("does not fire on NBSP (U+00A0) as thousands separator", () => {
    expectNoFinding("TYPO-NUM-03", "Цiна 1\u00A0234,56 евро.", "uk");
  });

  it("does not fire on NNBSP (U+202F) as thousands separator", () => {
    expectNoFinding("TYPO-NUM-03", "Цiна 1\u202F234,56 евро.", "uk");
  });

  it("does not fire on German text", () => {
    expectNoFinding("TYPO-NUM-03", "Der Preis 1 234,56 Euro.", "de");
  });
});

// ---------------------------------------------------------------------------
// TYPO-ABBR-01: Known abbreviation missing required trailing period
// ---------------------------------------------------------------------------

describe("TYPO-ABBR-01 — Missing trailing period on abbreviation", () => {
  it("detects Nr without period in German text", () => {
    expectFinding("TYPO-ABBR-01", "Siehe Nr 5 fuer Details.", "de");
  });

  it("does not fire on Nr. with period", () => {
    expectNoFinding("TYPO-ABBR-01", "Siehe Nr. 5 fuer Details.", "de");
  });

  it("detects usw without period in German text", () => {
    expectFinding("TYPO-ABBR-01", "Artikel, Preise usw werden gelistet.", "de");
  });

  it("does not fire on usw. with period", () => {
    expectNoFinding("TYPO-ABBR-01", "Artikel, Preise usw. werden gelistet.", "de");
  });

  it("detects напр without period in Ukrainian text", () => {
    expectFinding("TYPO-ABBR-01", "Див напр роздiл 5.", "uk");
  });

  it("does not fire on напр. with period", () => {
    expectNoFinding("TYPO-ABBR-01", "Наприклад напр. роздiл 5.", "uk");
  });
});

// ---------------------------------------------------------------------------
// TYPO-ABBR-02: German abbreviation with wrong internal spacing
// ---------------------------------------------------------------------------

describe("TYPO-ABBR-02 — Wrong internal spacing in German abbreviations", () => {
  it("detects z.B. without space", () => {
    expectFinding("TYPO-ABBR-02", "Das ist z.B. ein Beispiel.", "de");
  });

  it("does not fire on z. B. with space", () => {
    expectNoFinding("TYPO-ABBR-02", "Das ist z. B. ein Beispiel.", "de");
  });

  it("detects u.a. without space", () => {
    expectFinding("TYPO-ABBR-02", "Es gibt u.a. viele Optionen.", "de");
  });

  it("detects d.h. without space", () => {
    expectFinding("TYPO-ABBR-02", "Das ist d.h. wichtig.", "de");
  });

  it("does not fire on Ukrainian text", () => {
    expectNoFinding("TYPO-ABBR-02", "Це z.B. приклад.", "uk");
  });
});

// ---------------------------------------------------------------------------
// TYPO-APOS-01: Ukrainian word with curly apostrophe (U+2019)
// ---------------------------------------------------------------------------

describe("TYPO-APOS-01 — Curly apostrophe in Ukrainian", () => {
  it("detects curly apostrophe in Ukrainian word", () => {
    const text = "Слово iм\u2019я тут.";
    expectFinding("TYPO-APOS-01", text, "uk");
  });

  it("does not fire on straight apostrophe", () => {
    expectNoFinding("TYPO-APOS-01", "Слово iм'я тут.", "uk");
  });

  it("does not fire on German text", () => {
    expectNoFinding("TYPO-APOS-01", "Das ist ein\u2019Test.", "de");
  });

  it("respects allowedTokens exclusion", () => {
    const text = "Слово i\u043C\u2019\u044F тут.";
    const token = "i\u043C\u2019\u044F";
    const segment = makeSegment(text, "uk");
    const ctx = makeCtx("uk", new Set([token]));
    const rule = TIER2_LOCALE_RULES.find((r) => r.id === "TYPO-APOS-01") as TypographyRule;
    const findings = rule.check(segment, ctx);
    expect(findings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-APOS-02: Ukrainian word with modifier letter apostrophe (U+02BC)
// ---------------------------------------------------------------------------

describe("TYPO-APOS-02 — Modifier letter apostrophe in Ukrainian", () => {
  it("detects modifier letter apostrophe in Ukrainian word", () => {
    const text = "Слово iм\u02BCя тут.";
    expectFinding("TYPO-APOS-02", text, "uk");
  });

  it("does not fire on straight apostrophe", () => {
    expectNoFinding("TYPO-APOS-02", "Слово iм'я тут.", "uk");
  });

  it("does not fire on German text", () => {
    expectNoFinding("TYPO-APOS-02", "Das ist ein\u02BCtest.", "de");
  });

  it("respects allowedTokens exclusion", () => {
    const text = "Слово i\u043C\u02BC\u044F тут.";
    const token = "i\u043C\u02BC\u044F";
    const segment = makeSegment(text, "uk");
    const ctx = makeCtx("uk", new Set([token]));
    const rule = TIER2_LOCALE_RULES.find((r) => r.id === "TYPO-APOS-02") as TypographyRule;
    const findings = rule.check(segment, ctx);
    expect(findings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Export count verification
// ---------------------------------------------------------------------------

describe("TIER2_LOCALE_RULES export", () => {
  it("exports exactly 7 rules", () => {
    expect(TIER2_LOCALE_RULES).toHaveLength(7);
  });

  it("all rules are tier 2", () => {
    for (const rule of TIER2_LOCALE_RULES) {
      expect(rule.tier).toBe(2);
    }
  });

  it("all rule IDs use NUM, ABBR, or APOS families", () => {
    for (const rule of TIER2_LOCALE_RULES) {
      expect(["NUM", "ABBR", "APOS"]).toContain(rule.family);
    }
  });
});
