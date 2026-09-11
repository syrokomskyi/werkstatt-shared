/*
<MODULE_CONTRACT>
<purpose>Unit tests for the Tier 1 typography rules (RFC-1068).</purpose>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1068: initial creation.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { TIER1_RULES, createTypographyContext, DEFAULT_ALLOWED_TOKENS } from "./rules-tier1.ts";
import type { TypographyRule, TypographyContext } from "./rules-tier1.ts";
import type { TextSegment } from "./text-surface.ts";

function makeSegment(text: string, opts: Partial<TextSegment> = {}): TextSegment {
  return {
    file: opts.file ?? "src/content/pages/de/test.md",
    line: opts.line ?? 1,
    path: opts.path ?? "$body",
    source: opts.source ?? "body",
    text,
    raw: opts.raw ?? text,
    isTableRow: opts.isTableRow ?? false,
    locale: opts.locale ?? "de",
  };
}

function runRule(
  ruleId: string,
  segment: TextSegment,
  ctx?: TypographyContext,
): ReturnType<TypographyRule["check"]> {
  const rule = TIER1_RULES.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Rule ${ruleId} not found`);
  const context = ctx ?? createTypographyContext(segment.locale, new Set());
  return rule.check(segment, context);
}

// ---------------------------------------------------------------------------
// TYPO-PUNCT-01
// ---------------------------------------------------------------------------

describe("TYPO-PUNCT-01 (doubled/clashing punctuation)", () => {
  it("detects clashing comma-period", () => {
    const seg = makeSegment("Hello,. World");
    const findings = runRule("TYPO-PUNCT-01", seg);
    expect(findings.length).toBe(1);
    expect(findings[0].ruleId).toBe("TYPO-PUNCT-01");
  });

  it("detects doubled colon", () => {
    const seg = makeSegment("Hello:: World");
    const findings = runRule("TYPO-PUNCT-01", seg);
    expect(findings.length).toBe(1);
  });

  it("detects three exclamation marks", () => {
    const seg = makeSegment("Hello!!!");
    const findings = runRule("TYPO-PUNCT-01", seg);
    expect(findings.length).toBe(1);
  });

  it("allows ?! and !?", () => {
    expect(runRule("TYPO-PUNCT-01", makeSegment("What?! Really"))).toHaveLength(0);
    expect(runRule("TYPO-PUNCT-01", makeSegment("What!? Really"))).toHaveLength(0);
  });

  it("passes clean text", () => {
    expect(runRule("TYPO-PUNCT-01", makeSegment("Hello, World!"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-PUNCT-02
// ---------------------------------------------------------------------------

describe("TYPO-PUNCT-02 (two dots or 4+ dots)", () => {
  it("detects two consecutive dots", () => {
    const seg = makeSegment("Hello.. World");
    const findings = runRule("TYPO-PUNCT-02", seg);
    expect(findings.length).toBe(1);
  });

  it("detects four dots", () => {
    const seg = makeSegment("Hello.... World");
    const findings = runRule("TYPO-PUNCT-02", seg);
    expect(findings.length).toBe(1);
  });

  it("allows three-dot ellipsis", () => {
    expect(runRule("TYPO-PUNCT-02", makeSegment("Hello... World"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-PUNCT-03
// ---------------------------------------------------------------------------

describe("TYPO-PUNCT-03 (whitespace before closing punctuation)", () => {
  it("detects space before comma", () => {
    const seg = makeSegment("Hello , World");
    const findings = runRule("TYPO-PUNCT-03", seg);
    expect(findings.length).toBe(1);
  });

  it("detects space before period", () => {
    const seg = makeSegment("Hello . World");
    const findings = runRule("TYPO-PUNCT-03", seg);
    expect(findings.length).toBe(1);
  });

  it("passes clean text", () => {
    expect(runRule("TYPO-PUNCT-03", makeSegment("Hello, World."))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-PUNCT-04
// ---------------------------------------------------------------------------

describe("TYPO-PUNCT-04 (missing space after closing punctuation)", () => {
  it("detects missing space after comma", () => {
    const seg = makeSegment("Hello,World");
    const findings = runRule("TYPO-PUNCT-04", seg);
    expect(findings.length).toBe(1);
  });

  it("detects missing space after exclamation", () => {
    const seg = makeSegment("Hello!World");
    const findings = runRule("TYPO-PUNCT-04", seg);
    expect(findings.length).toBe(1);
  });

  it("allows decimal separator (digit,digit)", () => {
    expect(runRule("TYPO-PUNCT-04", makeSegment("3,14"))).toHaveLength(0);
  });

  it("passes clean text", () => {
    expect(runRule("TYPO-PUNCT-04", makeSegment("Hello, World"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-SPACE-01
// ---------------------------------------------------------------------------

describe("TYPO-SPACE-01 (double spaces)", () => {
  it("detects double spaces", () => {
    const seg = makeSegment("Hello  World");
    const findings = runRule("TYPO-SPACE-01", seg);
    expect(findings.length).toBe(1);
  });

  it("skips table rows", () => {
    const seg = makeSegment("Hello  World", { isTableRow: true });
    expect(runRule("TYPO-SPACE-01", seg)).toHaveLength(0);
  });

  it("passes single space", () => {
    expect(runRule("TYPO-SPACE-01", makeSegment("Hello World"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-SPACE-02
// ---------------------------------------------------------------------------

describe("TYPO-SPACE-02 (trailing whitespace)", () => {
  it("detects trailing spaces", () => {
    const seg = makeSegment("Hello World   ");
    const findings = runRule("TYPO-SPACE-02", seg);
    expect(findings.length).toBe(1);
  });

  it("detects trailing tabs", () => {
    const seg = makeSegment("Hello World\t");
    const findings = runRule("TYPO-SPACE-02", seg);
    expect(findings.length).toBe(1);
  });

  it("passes clean text", () => {
    expect(runRule("TYPO-SPACE-02", makeSegment("Hello World"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-SPACE-03
// ---------------------------------------------------------------------------

describe("TYPO-SPACE-03 (tab character)", () => {
  it("detects tab inside text", () => {
    const seg = makeSegment("Hello\tWorld");
    const findings = runRule("TYPO-SPACE-03", seg);
    expect(findings.length).toBe(1);
  });

  it("passes text without tabs", () => {
    expect(runRule("TYPO-SPACE-03", makeSegment("Hello World"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-SPACE-04
// ---------------------------------------------------------------------------

describe("TYPO-SPACE-04 (leading whitespace in frontmatter)", () => {
  it("detects leading whitespace in frontmatter string", () => {
    const seg = makeSegment("  Hello World", { source: "frontmatter" });
    const findings = runRule("TYPO-SPACE-04", seg);
    expect(findings.length).toBe(1);
  });

  it("skips body lines", () => {
    expect(runRule("TYPO-SPACE-04", makeSegment("  Hello World", { source: "body" }))).toHaveLength(
      0,
    );
  });

  it("passes clean frontmatter string", () => {
    expect(
      runRule("TYPO-SPACE-04", makeSegment("Hello World", { source: "frontmatter" })),
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-CASE-01
// ---------------------------------------------------------------------------

describe("TYPO-CASE-01 (uppercase between lowercase)", () => {
  it("detects camelCase corruption", () => {
    const seg = makeSegment("This is miXed text");
    const findings = runRule("TYPO-CASE-01", seg);
    expect(findings.length).toBe(1);
  });

  it("allows tokens in allowedTokens", () => {
    const seg = makeSegment("Use iPhone for photos");
    const ctx = createTypographyContext("de", new Set());
    expect(runRule("TYPO-CASE-01", seg, ctx)).toHaveLength(0);
  });

  it("passes clean text", () => {
    expect(runRule("TYPO-CASE-01", makeSegment("This is mixed text"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-CASE-02
// ---------------------------------------------------------------------------

describe("TYPO-CASE-02 (lowercase sentence start)", () => {
  it("detects lowercase after period", () => {
    const seg = makeSegment("Hello. this is wrong");
    const findings = runRule("TYPO-CASE-02", seg);
    expect(findings.length).toBe(1);
  });

  it("allows lowercase after abbreviation (de)", () => {
    const seg = makeSegment("Das ist z. B. eine Sache");
    const ctx = createTypographyContext("de", new Set());
    expect(runRule("TYPO-CASE-02", seg, ctx)).toHaveLength(0);
  });

  it("allows lowercase after digit sequence", () => {
    expect(runRule("TYPO-CASE-02", makeSegment("See 3. item for details"))).toHaveLength(0);
  });

  it("passes clean text", () => {
    expect(runRule("TYPO-CASE-02", makeSegment("Hello. World is nice"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-LOCALE-01
// ---------------------------------------------------------------------------

describe("TYPO-LOCALE-01 (mixed-script word)", () => {
  it("detects Latin+Cyrillic in one token", () => {
    const seg = makeSegment("This is wоrld text");
    const findings = runRule("TYPO-LOCALE-01", seg);
    expect(findings.length).toBe(1);
  });

  it("passes clean Latin text", () => {
    expect(runRule("TYPO-LOCALE-01", makeSegment("This is world text"))).toHaveLength(0);
  });

  it("passes clean Cyrillic text", () => {
    expect(runRule("TYPO-LOCALE-01", makeSegment("Це текст українською"))).toHaveLength(0);
  });

  it("excludes hyphenated tokens when Latin parts are in allowedTokens", () => {
    const ctx = createTypographyContext("uk", new Set(["IT", "PDF", "SEO"]));
    const seg = makeSegment("IT-сервіс-менеджер", { locale: "uk" });
    const findings = runRule("TYPO-LOCALE-01", seg, ctx);
    expect(findings).toHaveLength(0);
  });

  it("flags hyphenated tokens when Latin parts are NOT in allowedTokens", () => {
    const ctx = createTypographyContext("uk", new Set());
    const seg = makeSegment("IT-сервіс-менеджер", { locale: "uk" });
    const findings = runRule("TYPO-LOCALE-01", seg, ctx);
    expect(findings).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// TYPO-LOCALE-02
// ---------------------------------------------------------------------------

describe("TYPO-LOCALE-02 (foreign-alphabet letters in uk)", () => {
  it("detects Russian letters in Ukrainian text", () => {
    const seg = makeSegment("Це текст з буквою ы", { locale: "uk" });
    const findings = runRule("TYPO-LOCALE-02", seg);
    expect(findings.length).toBe(1);
  });

  it("skips non-uk locale", () => {
    const seg = makeSegment("This has ы in it", { locale: "de" });
    expect(runRule("TYPO-LOCALE-02", seg)).toHaveLength(0);
  });

  it("passes clean Ukrainian text", () => {
    expect(
      runRule("TYPO-LOCALE-02", makeSegment("Це чистий текст", { locale: "uk" })),
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-LOCALE-03
// ---------------------------------------------------------------------------

describe("TYPO-LOCALE-03 (Cyrillic in non-Cyrillic locale)", () => {
  it("detects Cyrillic in German text", () => {
    const seg = makeSegment("Das ist eine Тest", { locale: "de" });
    const findings = runRule("TYPO-LOCALE-03", seg);
    expect(findings.length).toBe(1);
  });

  it("skips Cyrillic in Ukrainian locale", () => {
    const seg = makeSegment("Це український текст", { locale: "uk" });
    expect(runRule("TYPO-LOCALE-03", seg)).toHaveLength(0);
  });

  it("allows Cyrillic in blockquote lines", () => {
    const seg = makeSegment("Das ist ein Zitat", { locale: "de", raw: "> Das ist ein Zitat" });
    expect(runRule("TYPO-LOCALE-03", seg)).toHaveLength(0);
  });

  it("passes clean Latin text", () => {
    expect(
      runRule("TYPO-LOCALE-03", makeSegment("Das ist ein Test", { locale: "de" })),
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-YAML-02
// ---------------------------------------------------------------------------

describe("TYPO-YAML-02 (odd double quotes)", () => {
  it("detects odd number of double quotes", () => {
    const seg = makeSegment('Hello "World', { source: "frontmatter" });
    const findings = runRule("TYPO-YAML-02", seg);
    expect(findings.length).toBe(1);
  });

  it("passes even number of double quotes", () => {
    expect(
      runRule("TYPO-YAML-02", makeSegment('Hello "World"', { source: "frontmatter" })),
    ).toHaveLength(0);
  });

  it("skips body lines", () => {
    expect(runRule("TYPO-YAML-02", makeSegment('Hello "World', { source: "body" }))).toHaveLength(
      0,
    );
  });
});

// ---------------------------------------------------------------------------
// TIER1_RULES registry
// ---------------------------------------------------------------------------

describe("TIER1_RULES", () => {
  it("has 14 rules", () => {
    expect(TIER1_RULES.length).toBe(14);
  });

  it("all rules have unique IDs", () => {
    const ids = TIER1_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all rules are tier 1", () => {
    expect(TIER1_RULES.every((r) => r.tier === 1)).toBe(true);
  });

  it("all rules have error severity", () => {
    expect(TIER1_RULES.every((r) => r.severity === "error")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createTypographyContext
// ---------------------------------------------------------------------------

describe("createTypographyContext", () => {
  it("merges allowed tokens with defaults", () => {
    const ctx = createTypographyContext("de", new Set(["MyToken"]));
    expect(ctx.allowedTokens.has("MyToken")).toBe(true);
    expect(ctx.allowedTokens.has("iPhone")).toBe(true);
  });

  it("loads abbreviations for de locale", () => {
    const ctx = createTypographyContext("de", new Set());
    expect(ctx.abbreviations.has("z. B.")).toBe(true);
  });

  it("loads abbreviations for uk locale", () => {
    const ctx = createTypographyContext("uk", new Set());
    expect(ctx.abbreviations.has("напр.")).toBe(true);
  });

  it("returns empty abbreviations for unknown locale", () => {
    const ctx = createTypographyContext("fr", new Set());
    expect(ctx.abbreviations.size).toBe(0);
  });
});
