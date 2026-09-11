/*
<MODULE_CONTRACT>
<purpose>Unit tests for Tier 2 structure typography rules (RFC-1069). Tests each
of the 9 rules (TYPO-HEAD-01..03, TYPO-PAIR-01..03, TYPO-MD-01..03) with
positive and negative cases, including edge cases for frontmatter heading
detection, link-stripping interactions, and placeholder exclusions.</purpose>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1069: initial test suite for 9 Tier 2 structure rules.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import {
  TIER2_STRUCTURE_RULES,
  createTypographyContext,
  type TextSegment,
  type TypographyFinding,
} from "./index.ts";

function makeSegment(
  text: string,
  overrides: Partial<TextSegment> = {},
): TextSegment {
  return {
    file: "test.md",
    line: 1,
    path: "$body",
    source: "body",
    text,
    raw: text,
    isTableRow: false,
    locale: "de",
    ...overrides,
  };
}

function makeFmSegment(
  text: string,
  path: string,
  overrides: Partial<TextSegment> = {},
): TextSegment {
  return makeSegment(text, {
    source: "frontmatter",
    path,
    ...overrides,
  });
}

const ctx = createTypographyContext("de", new Set());

function runRule(ruleId: string, segment: TextSegment): TypographyFinding[] {
  const rule = TIER2_STRUCTURE_RULES.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Rule ${ruleId} not found`);
  return rule.check(segment, ctx);
}

// ---------------------------------------------------------------------------
// TYPO-HEAD-01: Heading ends with a period
// ---------------------------------------------------------------------------

describe("TYPO-HEAD-01", () => {
  it("flags a body heading ending with a period", () => {
    const seg = makeSegment("## My Heading.");
    const findings = runRule("TYPO-HEAD-01", seg);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("TYPO-HEAD-01");
  });

  it("does not flag a body heading without trailing period", () => {
    const seg = makeSegment("## My Heading");
    expect(runRule("TYPO-HEAD-01", seg)).toHaveLength(0);
  });

  it("flags a frontmatter heading ending with a period", () => {
    const seg = makeFmSegment("My Heading.", "$.blocks[0].props.heading");
    expect(runRule("TYPO-HEAD-01", seg)).toHaveLength(1);
  });

  it("flags a frontmatter subheading ending with a period", () => {
    const seg = makeFmSegment("My Subheading.", "$.blocks[0].props.subheading");
    expect(runRule("TYPO-HEAD-01", seg)).toHaveLength(1);
  });

  it("does not flag a frontmatter non-heading key ending with a period", () => {
    const seg = makeFmSegment("Some text.", "$.blocks[0].props.title");
    expect(runRule("TYPO-HEAD-01", seg)).toHaveLength(0);
  });

  it("does not flag a non-heading body line ending with a period", () => {
    const seg = makeSegment("This is a sentence.");
    expect(runRule("TYPO-HEAD-01", seg)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-HEAD-02: Heading ends with a colon or dash
// ---------------------------------------------------------------------------

describe("TYPO-HEAD-02", () => {
  it("flags a heading ending with a colon", () => {
    const seg = makeSegment("## Heading:");
    expect(runRule("TYPO-HEAD-02", seg)).toHaveLength(1);
  });

  it("flags a heading ending with an em-dash", () => {
    const seg = makeSegment("## Heading\u2014");
    expect(runRule("TYPO-HEAD-02", seg)).toHaveLength(1);
  });

  it("flags a heading ending with an en-dash", () => {
    const seg = makeSegment("## Heading\u2013");
    expect(runRule("TYPO-HEAD-02", seg)).toHaveLength(1);
  });

  it("flags a heading ending with a hyphen", () => {
    const seg = makeSegment("## Heading-");
    expect(runRule("TYPO-HEAD-02", seg)).toHaveLength(1);
  });

  it("does not flag a heading without trailing colon or dash", () => {
    const seg = makeSegment("## Heading");
    expect(runRule("TYPO-HEAD-02", seg)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-HEAD-03: Heading ends with other closing punctuation
// ---------------------------------------------------------------------------

describe("TYPO-HEAD-03", () => {
  it("flags a heading ending with !", () => {
    const seg = makeSegment("## Heading!");
    expect(runRule("TYPO-HEAD-03", seg)).toHaveLength(1);
  });

  it("flags a heading ending with ?", () => {
    const seg = makeSegment("## Heading?");
    expect(runRule("TYPO-HEAD-03", seg)).toHaveLength(1);
  });

  it("flags a heading ending with )", () => {
    const seg = makeSegment("## Heading)");
    expect(runRule("TYPO-HEAD-03", seg)).toHaveLength(1);
  });

  it("does not flag a heading without trailing closing punctuation", () => {
    const seg = makeSegment("## Heading");
    expect(runRule("TYPO-HEAD-03", seg)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-PAIR-01: Unbalanced round parentheses
// ---------------------------------------------------------------------------

describe("TYPO-PAIR-01", () => {
  it("flags 3 opening and 2 closing parentheses", () => {
    const seg = makeSegment("Text (foo (bar) baz");
    const findings = runRule("TYPO-PAIR-01", seg);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("TYPO-PAIR-01");
  });

  it("does not flag balanced parentheses", () => {
    const seg = makeSegment("Text (foo) and (bar)");
    expect(runRule("TYPO-PAIR-01", seg)).toHaveLength(0);
  });

  it("does not flag text with formula placeholder", () => {
    const seg = makeSegment("Text \uE000 end");
    expect(runRule("TYPO-PAIR-01", seg)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-PAIR-02: Orphaned closing square bracket
// ---------------------------------------------------------------------------

describe("TYPO-PAIR-02", () => {
  it("flags an orphaned ]", () => {
    const seg = makeSegment("Text ] end");
    expect(runRule("TYPO-PAIR-02", seg)).toHaveLength(1);
  });

  it("does not flag balanced [text]", () => {
    const seg = makeSegment("Text [text] end");
    expect(runRule("TYPO-PAIR-02", seg)).toHaveLength(0);
  });

  it("does not flag [text from a stripped link (orphaned [ is not a defect)", () => {
    const seg = makeSegment("See [text for details");
    expect(runRule("TYPO-PAIR-02", seg)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-PAIR-03: Unbalanced curly braces
// ---------------------------------------------------------------------------

describe("TYPO-PAIR-03", () => {
  it("flags unbalanced curly braces (more opening)", () => {
    const seg = makeSegment("Text {foo {bar}");
    expect(runRule("TYPO-PAIR-03", seg)).toHaveLength(1);
  });

  it("flags unbalanced curly braces (more closing)", () => {
    const seg = makeSegment("Text {foo}}");
    expect(runRule("TYPO-PAIR-03", seg)).toHaveLength(1);
  });

  it("does not flag balanced curly braces", () => {
    const seg = makeSegment("Text {foo} and {bar}");
    expect(runRule("TYPO-PAIR-03", seg)).toHaveLength(0);
  });

  it("does not flag CMS placeholder (braces already stripped)", () => {
    const seg = makeSegment("Text \uE002 end");
    expect(runRule("TYPO-PAIR-03", seg)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-MD-01: Unclosed inline code span (odd backticks)
// ---------------------------------------------------------------------------

describe("TYPO-MD-01", () => {
  it("flags an odd number of backticks", () => {
    const seg = makeSegment("Text `code end");
    expect(runRule("TYPO-MD-01", seg)).toHaveLength(1);
  });

  it("does not flag an even number of backticks", () => {
    const seg = makeSegment("Text `code` end");
    expect(runRule("TYPO-MD-01", seg)).toHaveLength(0);
  });

  it("does not flag frontmatter segments", () => {
    const seg = makeFmSegment("Text `code", "$.blocks[0].props.text");
    expect(runRule("TYPO-MD-01", seg)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-MD-02: Broken link target syntax
// ---------------------------------------------------------------------------

describe("TYPO-MD-02", () => {
  it("flags ]( without preceding [", () => {
    const seg = makeSegment("Text ](url end");
    expect(runRule("TYPO-MD-02", seg)).toHaveLength(1);
  });

  it("does not flag a complete link after stripping", () => {
    // After link stripping, [text](url) becomes [text — no ]( remains
    const seg = makeSegment("See [text for details");
    expect(runRule("TYPO-MD-02", seg)).toHaveLength(0);
  });

  it("does not flag frontmatter segments", () => {
    const seg = makeFmSegment("Text ](url", "$.blocks[0].props.text");
    expect(runRule("TYPO-MD-02", seg)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TYPO-MD-03: Unclosed emphasis marker
// ---------------------------------------------------------------------------

describe("TYPO-MD-03", () => {
  it("flags an odd number of asterisks", () => {
    const seg = makeSegment("Text *bold end");
    expect(runRule("TYPO-MD-03", seg)).toHaveLength(1);
  });

  it("does not flag an even number of asterisks", () => {
    const seg = makeSegment("Text **bold** end");
    expect(runRule("TYPO-MD-03", seg)).toHaveLength(0);
  });

  it("flags an odd number of underscores", () => {
    const seg = makeSegment("Text _italic end");
    expect(runRule("TYPO-MD-03", seg)).toHaveLength(1);
  });

  it("does not flag an even number of underscores", () => {
    const seg = makeSegment("Text _italic_ end");
    expect(runRule("TYPO-MD-03", seg)).toHaveLength(0);
  });

  it("does not flag frontmatter segments", () => {
    const seg = makeFmSegment("Text *bold", "$.blocks[0].props.text");
    expect(runRule("TYPO-MD-03", seg)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TIER2_STRUCTURE_RULES export
// ---------------------------------------------------------------------------

describe("TIER2_STRUCTURE_RULES", () => {
  it("exports exactly 9 rules", () => {
    expect(TIER2_STRUCTURE_RULES).toHaveLength(9);
  });

  it("all rules have tier 2", () => {
    for (const rule of TIER2_STRUCTURE_RULES) {
      expect(rule.tier).toBe(2);
    }
  });

  it("all rules have severity error", () => {
    for (const rule of TIER2_STRUCTURE_RULES) {
      expect(rule.severity).toBe("error");
    }
  });

  it("covers HEAD, PAIR, and MD families", () => {
    const families = new Set(TIER2_STRUCTURE_RULES.map((r) => r.family));
    expect(families).toEqual(new Set(["HEAD", "PAIR", "MD"]));
  });
});
