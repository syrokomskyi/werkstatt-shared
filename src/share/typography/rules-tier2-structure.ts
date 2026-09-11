/*
<MODULE_CONTRACT>
<purpose>Tier 2 structure typography rules (RFC-1069). Implements 9 rules across
3 families: HEAD (3), PAIR (3), MD (3). Rules operate on TextSegment objects
produced by the text-surface extractor (RFC-1068), never on raw file bytes.
All regexes use the `u` flag and Unicode property escapes where applicable.</purpose>
<non-goals>
  <item>Do not extract text — that is text-surface.ts.</item>
  <item>Do not handle file I/O or command registration — that is the command adapter.</item>
  <item>Do not auto-fix — autofix is RFC-1072.</item>
  <item>Do not validate heading hierarchy — that is a semantic concern, not typographic.</item>
  <item>Do not validate list item punctuation — that is RFC-1067 (list.punctuation.validate).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1069: initial creation with 9 Tier 2 structure rules.</item>
</CHANGE_SUMMARY>
*/

import type { TextSegment } from "./text-surface.ts";
import { finding, type TypographyFinding, type TypographyRule } from "./rules-tier1.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tier2StructureRuleId = `TYPO-${"HEAD" | "PAIR" | "MD"}-${string}`;

// ---------------------------------------------------------------------------
// Helper: extract last path segment from a JSON-path
// e.g. "$.blocks[0].props.heading" → "heading"
// ---------------------------------------------------------------------------

function lastPathKey(path: string): string | undefined {
  const parts = path.split(".");
  const last = parts[parts.length - 1];
  if (!last || last.startsWith("$") || last.includes("[")) return undefined;
  return last;
}

// ---------------------------------------------------------------------------
// Helper: check if a segment is a heading (body or frontmatter)
// ---------------------------------------------------------------------------

function isBodyHeading(text: string): boolean {
  return /^#{1,6}\s+/u.test(text);
}

function isFrontmatterHeading(segment: TextSegment): boolean {
  if (segment.source !== "frontmatter") return false;
  const key = lastPathKey(segment.path);
  return key === "heading" || key === "subheading";
}

// ---------------------------------------------------------------------------
// TYPO-HEAD-01: Heading ends with a period
// ---------------------------------------------------------------------------

const HEAD01_PERIOD = /[.]\s*$/u;

const head01: TypographyRule = {
  id: "TYPO-HEAD-01",
  family: "HEAD",
  tier: 2,
  severity: "error",
  check(segment) {
    const text = segment.text;
    if (!isBodyHeading(text) && !isFrontmatterHeading(segment)) return [];
    const match = HEAD01_PERIOD.exec(text);
    if (!match) return [];
    const col = match.index;
    return [
      finding(
        "TYPO-HEAD-01",
        segment,
        match[0],
        col,
        "Heading ends with a period — a heading is a title, not a sentence.",
        "Remove the trailing period.",
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// TYPO-HEAD-02: Heading ends with a colon or dash
// ---------------------------------------------------------------------------

const HEAD02_COLON_DASH = /[:\u2014\u2013-]\s*$/u;

const head02: TypographyRule = {
  id: "TYPO-HEAD-02",
  family: "HEAD",
  tier: 2,
  severity: "error",
  check(segment) {
    const text = segment.text;
    if (!isBodyHeading(text) && !isFrontmatterHeading(segment)) return [];
    const match = HEAD02_COLON_DASH.exec(text);
    if (!match) return [];
    const col = match.index;
    return [
      finding(
        "TYPO-HEAD-02",
        segment,
        match[0],
        col,
        "Heading ends with a colon or dash — trailing punctuation is always wrong in a heading.",
        "Remove the trailing colon or dash.",
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// TYPO-HEAD-03: Heading ends with other closing punctuation (!?)])
// ---------------------------------------------------------------------------

const HEAD03_OTHER = /[)!?]\s*$/u;

const head03: TypographyRule = {
  id: "TYPO-HEAD-03",
  family: "HEAD",
  tier: 2,
  severity: "error",
  check(segment) {
    const text = segment.text;
    if (!isBodyHeading(text) && !isFrontmatterHeading(segment)) return [];
    const match = HEAD03_OTHER.exec(text);
    if (!match) return [];
    const col = match.index;
    return [
      finding(
        "TYPO-HEAD-03",
        segment,
        match[0],
        col,
        "Heading ends with closing punctuation (!, ?, or )) — a heading should not end with these marks.",
        "Remove the trailing punctuation.",
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// TYPO-PAIR-01: Unbalanced round parentheses
// Exclusions: code spans (already stripped), formulas (replaced with placeholder)
// ---------------------------------------------------------------------------

function countChar(text: string, ch: string): number {
  let count = 0;
  for (const c of text) {
    if (c === ch) count++;
  }
  return count;
}

const pair01: TypographyRule = {
  id: "TYPO-PAIR-01",
  family: "PAIR",
  tier: 2,
  severity: "error",
  check(segment) {
    const text = segment.text;
    const open = countChar(text, "(");
    const close = countChar(text, ")");
    if (open === close) return [];
    const col = open > close ? text.lastIndexOf("(") : text.lastIndexOf(")");
    return [
      finding(
        "TYPO-PAIR-01",
        segment,
        open > close ? "(" : ")",
        col,
        `Unbalanced round parentheses — ${open} opening, ${close} closing.`,
        "Add or remove a parenthesis to balance the pair.",
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// TYPO-PAIR-02: Orphaned closing square bracket
// After removing balanced [...] pairs, any ] remaining is an orphan.
// Exclusions: markdown link syntax (the link-stripping step removes ](...) leaving
// [text — orphaned [ is expected and not a defect); code spans
// ---------------------------------------------------------------------------

const pair02: TypographyRule = {
  id: "TYPO-PAIR-02",
  family: "PAIR",
  tier: 2,
  severity: "error",
  check(segment) {
    const text = segment.text;
    // Find orphan ] by scanning the original string and skipping balanced [..] pairs.
    let i = 0;
    let bracketDepth = 0;
    while (i < text.length) {
      if (text[i] === "[") {
        bracketDepth++;
      } else if (text[i] === "]") {
        if (bracketDepth === 0) {
          return [
            finding(
              "TYPO-PAIR-02",
              segment,
              "]",
              i,
              "Orphaned closing square bracket — a ] without a matching [.",
              "Add the opening [ or remove the orphaned ].",
            ),
          ];
        }
        bracketDepth--;
      }
      i++;
    }
    return [];
  },
};

// ---------------------------------------------------------------------------
// TYPO-PAIR-03: Unbalanced curly braces
// Exclusions: formula expressions (replaced with placeholder), frontmatter
// template variables (replaced with CMS placeholder by extractor)
// ---------------------------------------------------------------------------

const pair03: TypographyRule = {
  id: "TYPO-PAIR-03",
  family: "PAIR",
  tier: 2,
  severity: "error",
  check(segment) {
    const text = segment.text;
    const open = countChar(text, "{");
    const close = countChar(text, "}");
    if (open === close) return [];
    const col = open > close ? text.lastIndexOf("{") : text.lastIndexOf("}");
    return [
      finding(
        "TYPO-PAIR-03",
        segment,
        open > close ? "{" : "}",
        col,
        `Unbalanced curly braces — ${open} opening, ${close} closing.`,
        "Add or remove a brace to balance the pair.",
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// TYPO-MD-01: Unclosed inline code span (odd number of backticks)
// Exclusions: fenced code blocks (removed by extractor)
// ---------------------------------------------------------------------------

const md01: TypographyRule = {
  id: "TYPO-MD-01",
  family: "MD",
  tier: 2,
  severity: "error",
  check(segment) {
    if (segment.source !== "body") return [];
    const text = segment.text;
    const backtickCount = countChar(text, "`");
    if (backtickCount % 2 === 0) return [];
    const col = text.lastIndexOf("`");
    return [
      finding(
        "TYPO-MD-01",
        segment,
        "`",
        col,
        `Unclosed inline code span — odd number of backticks (${backtickCount}).`,
        "Add a closing backtick to match the opening.",
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// TYPO-MD-02: Broken link target syntax (](… without preceding [)
// Only checks ]( without a preceding ] on the same segment.
// Unclosed [text at end of segment is NOT checked because the link-stripping
// step removes ](...) making [text indistinguishable from a complete link.
// ---------------------------------------------------------------------------

const MD02_PATTERN = /(?<!\])\]\(/u;

const md02: TypographyRule = {
  id: "TYPO-MD-02",
  family: "MD",
  tier: 2,
  severity: "error",
  check(segment) {
    if (segment.source !== "body") return [];
    const text = segment.text;
    const match = MD02_PATTERN.exec(text);
    if (!match) return [];
    return [
      finding(
        "TYPO-MD-02",
        segment,
        match[0],
        match.index,
        "Broken link target syntax — ]( without a matching [.",
        "Add the opening [ or remove the orphaned ](.",
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// TYPO-MD-03: Unclosed emphasis marker (odd count of * or _)
// Exclusions: code spans (already stripped); formulas (replaced with placeholder)
// ---------------------------------------------------------------------------

const md03: TypographyRule = {
  id: "TYPO-MD-03",
  family: "MD",
  tier: 2,
  severity: "error",
  check(segment) {
    if (segment.source !== "body") return [];
    const text = segment.text;
    const starCount = countChar(text, "*");
    const underscoreCount = countChar(text, "_");
    const findings: TypographyFinding[] = [];
    if (starCount % 2 !== 0) {
      const col = text.lastIndexOf("*");
      findings.push(
        finding(
          "TYPO-MD-03",
          segment,
          "*",
          col,
          `Unclosed emphasis marker — odd number of asterisks (${starCount}).`,
          "Add a closing * to match the opening.",
        ),
      );
    }
    if (underscoreCount % 2 !== 0) {
      const col = text.lastIndexOf("_");
      findings.push(
        finding(
          "TYPO-MD-03",
          segment,
          "_",
          col,
          `Unclosed emphasis marker — odd number of underscores (${underscoreCount}).`,
          "Add a closing _ to match the opening.",
        ),
      );
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// Export all Tier 2 structure rules
// ---------------------------------------------------------------------------

export const TIER2_STRUCTURE_RULES: readonly TypographyRule[] = [
  head01,
  head02,
  head03,
  pair01,
  pair02,
  pair03,
  md01,
  md02,
  md03,
];
