/*
<MODULE_CONTRACT>
<purpose>Tier 1 typography rule engine (RFC-1068). Implements 14 rules across
5 families: PUNCT (4), SPACE (4), CASE (2), LOCALE (3), YAML (2). All regexes
use the `u` flag and Unicode property escapes. Rules operate on TextSegment
objects produced by the text-surface extractor, never on raw file bytes.
TypographyRuleId and TypographyRuleFamily include Tier 2 families (HEAD, PAIR,
MD per RFC-1069; NUM, ABBR, APOS per RFC-1070) and Tier 3 families (UNICODE, LINK,
SENT per RFC-1071) so that Tier 2 and Tier 3 rule arrays can be typed as
TypographyRule[].</purpose>
<non-goals>
  <item>Do not extract text — that is text-surface.ts.</item>
  <item>Do not handle file I/O or command registration — that is the command adapter.</item>
  <item>Do not auto-fix — autofix is RFC-1072.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1068: initial creation with 14 Tier 1 rules.</item>
  <item>RFC-1069: extended TypographyRuleId and TypographyRuleFamily with HEAD, PAIR, MD families.</item>
  <item>RFC-1070: extended TypographyRuleId and TypographyRuleFamily with NUM, ABBR, APOS families; added localeDefaults to TypographyContext.</item>
  <item>RFC-1071: extended TypographyRuleId and TypographyRuleFamily with UNICODE, LINK, SENT families.</item>
  <item>RFC-1072: changed TypographyFinding.fix from null to FixAction | null; extended finding() helper with optional FixAction param; populated fix on PUNCT-01, SPACE-01, SPACE-02.</item>
</CHANGE_SUMMARY>
*/

import type { TextSegment } from "./text-surface.ts";
import type { FixAction } from "./fix.ts";
import {
  LOCALE_DEFAULTS,
  getLocaleDefaults,
  type LocaleTypographyDefaults,
} from "./locale-defaults.ts";

// ---------------------------------------------------------------------------
// Types (from RFC-1068)
// ---------------------------------------------------------------------------

export type TypographyRuleId = `TYPO-${
  | "PUNCT"
  | "SPACE"
  | "CASE"
  | "LOCALE"
  | "YAML"
  | "HEAD"
  | "PAIR"
  | "MD"
  | "NUM"
  | "ABBR"
  | "APOS"
  | "UNICODE"
  | "LINK"
  | "SENT"}-${string}`;

export type TypographyRuleFamily =
  | "PUNCT"
  | "SPACE"
  | "CASE"
  | "LOCALE"
  | "YAML"
  | "HEAD"
  | "PAIR"
  | "MD"
  | "NUM"
  | "ABBR"
  | "APOS"
  | "UNICODE"
  | "LINK"
  | "SENT";

export interface TypographyFinding {
  ruleId: TypographyRuleId;
  segment: TextSegment;
  /** 0-based column inside segment.text. */
  column: number;
  /** Offending substring (for messages and fix). */
  match: string;
  message: string;
  fixHint: string;
  /** Set by rules whitelisted in RFC-1072; null for non-fixable rules. */
  fix: FixAction | null;
}

export interface TypographyRule {
  id: TypographyRuleId;
  family: TypographyRuleFamily;
  tier: 1 | 2 | 3;
  severity: "error" | "warning";
  check(segment: TextSegment, ctx: TypographyContext): TypographyFinding[];
}

export interface TypographyContext {
  locale: string;
  allowedTokens: ReadonlySet<string>;
  abbreviations: ReadonlySet<string>;
  /** Locale-specific typography defaults (number format, apostrophe policy). Added by RFC-1070. */
  localeDefaults: LocaleTypographyDefaults;
}

// ---------------------------------------------------------------------------
// Default allowed tokens seed (TYPO-CASE-01 and TYPO-LOCALE-03 exclusions)
// ---------------------------------------------------------------------------

export const DEFAULT_ALLOWED_TOKENS = new Set([
  "iPhone",
  "iPad",
  "eBay",
  "GitHub",
  "YouTube",
  "LinkedIn",
  "WordPress",
  "JavaScript",
  "TypeScript",
  "PayPal",
  "macOS",
  "iOS",
  "OpenAI",
]);

// ---------------------------------------------------------------------------
// Helper: create a finding
// ---------------------------------------------------------------------------

export function finding(
  ruleId: TypographyRuleId,
  segment: TextSegment,
  match: string,
  column: number,
  message: string,
  fixHint: string,
  fix: FixAction | null = null,
): TypographyFinding {
  return { ruleId, segment, match, column, message, fixHint, fix };
}

// ---------------------------------------------------------------------------
// Helper: check if a token is in allowedTokens
// ---------------------------------------------------------------------------

function isAllowedToken(token: string, ctx: TypographyContext): boolean {
  if (ctx.allowedTokens.has(token)) return true;
  // Also check with leading/trailing punctuation stripped
  const stripped = token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
  if (stripped !== token && ctx.allowedTokens.has(stripped)) return true;
  // Also check hyphenated parts (e.g. LinkedIn-Profil → LinkedIn)
  for (const part of stripped.split("-")) {
    if (part.length > 0 && ctx.allowedTokens.has(part)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helper: extract tokens (maximal non-whitespace sequences) from text
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Placeholder characters — treated as letters for spacing, skipped for casing/locale
// ---------------------------------------------------------------------------

const FORMULA_PLACEHOLDER = "\uE000";
const URL_PLACEHOLDER = "\uE001";
const CMS_PLACEHOLDER = "\uE002";

function isPlaceholder(ch: string): boolean {
  return ch === FORMULA_PLACEHOLDER || ch === URL_PLACEHOLDER || ch === CMS_PLACEHOLDER;
}

// ---------------------------------------------------------------------------
// TYPO-PUNCT-01: Doubled or clashing punctuation
// Pattern: [,;:!?]\. · \.[,;] · :: · ;; · ,, · [!?]{3,}
// Exclusions: ?! and !? are allowed
// ---------------------------------------------------------------------------

const PUNCT01_PATTERNS: RegExp[] = [/[,;:!?]\./u, /\.[,;]/u, /::/u, /;;/u, /,,/u, /[!?]{3,}/u];

/**
 * Deduplicate clashing punctuation for PUNCT-01 fix.
 * [,;:!?]. → . (keep the period)
 * .[,;] → . (keep the period)
 * :: → :
 * ;; → ;
 * ,, → ,
 * [!?]{3,} → !! (keep first two)
 */
function dedupPunct(matched: string): string {
  // [,;:!?]. — closing mark followed by period → keep period
  if (/^[,;:!?]\.$/.test(matched)) return ".";
  // .[,;] — period followed by comma/semicolon → keep period
  if (/^\.[,;]$/.test(matched)) return ".";
  // :: → :
  if (matched === "::") return ":";
  // ;; → ;
  if (matched === ";;") return ";";
  // ,, → ,
  if (matched === ",,") return ",";
  // [!?]{3,} → keep first two
  if (/^[!?]{3,}$/.test(matched)) return matched.slice(0, 2);
  return matched;
}

const PUNCT01_MESSAGES: Record<string, { message: string; fixHint: string }> = {
  "[,;:!?]\\.": {
    message: "Clashing punctuation — a closing mark followed by a period.",
    fixHint: "Keep exactly one closing mark.",
  },
  "\\.[,;]": {
    message: "Clashing punctuation — a period followed by a comma or semicolon.",
    fixHint: "Keep exactly one closing mark.",
  },
  "::": {
    message: "Doubled colon.",
    fixHint: "Use a single colon.",
  },
  ";;": {
    message: "Doubled semicolon.",
    fixHint: "Use a single semicolon.",
  },
  ",,": {
    message: "Doubled comma.",
    fixHint: "Use a single comma.",
  },
  "[!?]{3,}": {
    message: "Three or more exclamation/question marks in a row.",
    fixHint: "Use at most two exclamation or question marks.",
  },
};

const punct01: TypographyRule = {
  id: "TYPO-PUNCT-01",
  family: "PUNCT",
  tier: 1,
  severity: "error",
  check(segment, ctx) {
    const findings: TypographyFinding[] = [];
    const text = segment.text;
    for (const pattern of PUNCT01_PATTERNS) {
      const match = pattern.exec(text);
      if (match) {
        // Check if it's ?! or !? — those are allowed
        const matched = match[0];
        if (matched === "?!" || matched === "!?") continue;

        // Exclusion: period followed by comma/semicolon where the period
        // is the last char of a known abbreviation (e.g. "e.V.,", "Inc.,")
        if (pattern.source === "\\.[,;]") {
          const textUpToDot = text.slice(0, match.index + 1);
          let isAbbrev = false;
          for (const abbr of ctx.abbreviations) {
            if (textUpToDot.endsWith(abbr)) {
              isAbbrev = true;
              break;
            }
          }
          if (isAbbrev) continue;
        }

        const key = pattern.source;
        const msg = PUNCT01_MESSAGES[key] ?? {
          message: `Doubled or clashing punctuation: "${matched}".`,
          fixHint: "Keep exactly one closing mark.",
        };
        findings.push(
          finding(this.id, segment, matched, match.index, msg.message, msg.fixHint, {
            type: "replace",
            old: matched,
            new: dedupPunct(matched),
          }),
        );
      }
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// TYPO-PUNCT-02: Two dots or four-plus dots (not three-dot ellipsis)
// Pattern: (?<!\.)\.\.(?!\.) · \.{4,}
// ---------------------------------------------------------------------------

const PUNCT02_DOUBLE_DOT = /(?<!\.)\.\.(?!\.)/u;
const PUNCT02_MANY_DOTS = /\.{4,}/u;

const punct02: TypographyRule = {
  id: "TYPO-PUNCT-02",
  family: "PUNCT",
  tier: 1,
  severity: "error",
  check(segment, ctx) {
    const findings: TypographyFinding[] = [];
    const text = segment.text;
    let m = PUNCT02_DOUBLE_DOT.exec(text);
    if (m) {
      // Exclusion: first dot is the last char of a known abbreviation
      const textUpToFirstDot = text.slice(0, m.index + 1);
      let isAbbrev = false;
      for (const abbr of ctx.abbreviations) {
        if (textUpToFirstDot.endsWith(abbr)) {
          isAbbrev = true;
          break;
        }
      }
      if (!isAbbrev) {
        findings.push(
          finding(
            this.id,
            segment,
            m[0],
            m.index,
            "Two consecutive dots (not a three-dot ellipsis).",
            "Use a single period or a three-dot ellipsis (...).",
          ),
        );
      }
    }
    m = PUNCT02_MANY_DOTS.exec(text);
    if (m) {
      findings.push(
        finding(
          this.id,
          segment,
          m[0],
          m.index,
          "Four or more consecutive dots.",
          "Use a three-dot ellipsis (...) or a single period.",
        ),
      );
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// TYPO-PUNCT-03: Whitespace before closing punctuation
// Pattern: \s[,;:!?] · \s\.(?!\.\.)
// Exclusions: \s\.\.\. (spaced ellipsis) is allowed
// ---------------------------------------------------------------------------

const PUNCT03_WS_BEFORE_PUNCT = /\s[,;:!?]/u;
const PUNCT03_WS_BEFORE_DOT = /\s\.(?!\.)/u;

const punct03: TypographyRule = {
  id: "TYPO-PUNCT-03",
  family: "PUNCT",
  tier: 1,
  severity: "error",
  check(segment, _ctx) {
    const findings: TypographyFinding[] = [];
    const text = segment.text;
    let m = PUNCT03_WS_BEFORE_PUNCT.exec(text);
    if (m) {
      findings.push(
        finding(
          this.id,
          segment,
          m[0],
          m.index,
          "Whitespace before closing punctuation.",
          "Remove the space before the punctuation mark.",
        ),
      );
    }
    m = PUNCT03_WS_BEFORE_DOT.exec(text);
    if (m) {
      findings.push(
        finding(
          this.id,
          segment,
          m[0],
          m.index,
          "Whitespace before a period.",
          "Remove the space before the period.",
        ),
      );
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// TYPO-PUNCT-04: Missing space after closing punctuation before a letter
// Pattern: [,;!?]\p{L} · (?<!\b\p{L})\.\p{L}
// Exclusions: single-letter abbreviation stems (z.B., u.a.) — deferred to TYPO-ABBR (RFC-1070);
//   URL/e-mail/domain tokens; decimal separators followed by digits
// ---------------------------------------------------------------------------

const PUNCT04_COMMA_SEMICOLON_EXCL = /[,;!?]\p{L}/u;
const PUNCT04_DOT_LETTER = /(?<!\b\p{L})\.\p{L}/u;

const punct04: TypographyRule = {
  id: "TYPO-PUNCT-04",
  family: "PUNCT",
  tier: 1,
  severity: "error",
  check(segment, _ctx) {
    const findings: TypographyFinding[] = [];
    const text = segment.text;

    let m = PUNCT04_COMMA_SEMICOLON_EXCL.exec(text);
    if (m) {
      // Skip decimal separators (digit,digit)
      const before = text[m.index - 1];
      const after = text[m.index + 2];
      if (before && /\p{Nd}/u.test(before) && after && /\p{Nd}/u.test(after)) {
        // decimal separator — skip
      } else {
        findings.push(
          finding(
            this.id,
            segment,
            m[0],
            m.index,
            "Missing space after closing punctuation before a letter.",
            "Add a space after the punctuation mark.",
          ),
        );
      }
    }

    m = PUNCT04_DOT_LETTER.exec(text);
    if (m) {
      // Version pattern exclusion: \d+\.x\b (e.g. "4.x", "2.0.x") — RFC-1083.
      // match[0] is ".x" (dot + letter), NOT "4.x". Check the character before
      // the dot (must be a digit) and the letter after the dot (must be "x"
      // followed by a non-word character or end of string).
      const beforeChar = text[m.index - 1];
      const letterAfterDot = text[m.index + 1];
      const afterLetter = text[m.index + 2];
      if (
        beforeChar !== undefined &&
        /\p{Nd}/u.test(beforeChar) &&
        letterAfterDot === "x" &&
        (afterLetter === undefined || /\W/u.test(afterLetter) || afterLetter === " ")
      ) {
        // version designator like "4.x" — skip
      } else {
        // Skip if preceded by a single letter (abbreviation like z.B.)
        if (beforeChar && /\p{L}/u.test(beforeChar)) {
          // Check if it's a single-letter abbreviation (X.Y pattern)
          const beforeBefore = text[m.index - 2];
          if (!beforeBefore || /\s/.test(beforeBefore)) {
            // Single letter before dot — likely abbreviation, skip
          } else {
            findings.push(
              finding(
                this.id,
                segment,
                m[0],
                m.index,
                "Missing space after a period before a letter.",
                "Add a space after the period.",
              ),
            );
          }
        } else {
          findings.push(
            finding(
              this.id,
              segment,
              m[0],
              m.index,
              "Missing space after a period before a letter.",
              "Add a space after the period.",
            ),
          );
        }
      }
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// TYPO-SPACE-01: Two or more consecutive spaces inside text
// Pattern: \S {2,}\S
// Exclusions: markdown table rows
// ---------------------------------------------------------------------------

const SPACE01 = /\S {2,}\S/u;

const space01: TypographyRule = {
  id: "TYPO-SPACE-01",
  family: "SPACE",
  tier: 1,
  severity: "error",
  check(segment, _ctx) {
    if (segment.isTableRow) return [];
    const m = SPACE01.exec(segment.text);
    if (m) {
      return [
        finding(
          this.id,
          segment,
          m[0],
          m.index,
          "Two or more consecutive spaces inside text.",
          "Use a single space.",
          { type: "replace", old: m[0], new: m[0].replace(/ {2,}/g, " ") },
        ),
      ];
    }
    return [];
  },
};

// ---------------------------------------------------------------------------
// TYPO-SPACE-02: Trailing whitespace at end of a frontmatter string or body line
// Pattern: [ \t]+$
// Exclusions: none — markdown two-space hard breaks are forbidden
// ---------------------------------------------------------------------------

const SPACE02 = /[ \t]+$/u;

const space02: TypographyRule = {
  id: "TYPO-SPACE-02",
  family: "SPACE",
  tier: 1,
  severity: "error",
  check(segment, _ctx) {
    const m = SPACE02.exec(segment.text);
    if (m) {
      return [
        finding(
          this.id,
          segment,
          m[0],
          m.index,
          "Trailing whitespace at end of line.",
          "Remove trailing spaces.",
          { type: "delete", at: m.index, length: m[0].length },
        ),
      ];
    }
    return [];
  },
};

// ---------------------------------------------------------------------------
// TYPO-SPACE-03: Tab character inside text
// Pattern: \t
// Exclusions: fenced code blocks (already stripped by extractor)
// ---------------------------------------------------------------------------

const SPACE03 = /\t/u;

const space03: TypographyRule = {
  id: "TYPO-SPACE-03",
  family: "SPACE",
  tier: 1,
  severity: "error",
  check(segment, _ctx) {
    const m = SPACE03.exec(segment.text);
    if (m) {
      return [
        finding(
          this.id,
          segment,
          m[0],
          m.index,
          "Tab character inside text.",
          "Use spaces instead of tabs.",
        ),
      ];
    }
    return [];
  },
};

// ---------------------------------------------------------------------------
// TYPO-SPACE-04: Leading whitespace in a frontmatter string value
// Pattern: ^[ \t]+
// Exclusions: none
// ---------------------------------------------------------------------------

const SPACE04 = /^[ \t]+/u;

const space04: TypographyRule = {
  id: "TYPO-SPACE-04",
  family: "SPACE",
  tier: 1,
  severity: "error",
  check(segment, _ctx) {
    if (segment.source !== "frontmatter") return [];
    const m = SPACE04.exec(segment.text);
    if (m) {
      return [
        finding(
          this.id,
          segment,
          m[0],
          m.index,
          "Leading whitespace in a frontmatter string value.",
          "Remove leading spaces from the value.",
        ),
      ];
    }
    return [];
  },
};

// ---------------------------------------------------------------------------
// TYPO-CASE-01: Uppercase letter between two lowercase letters inside a word
// Pattern: \p{Ll}\p{Lu}\p{Ll}
// Exclusions: tokens in typography.allowedTokens; code spans; formulas; URLs
// ---------------------------------------------------------------------------

const CASE01 = /\p{Ll}\p{Lu}\p{Ll}/u;

const case01: TypographyRule = {
  id: "TYPO-CASE-01",
  family: "CASE",
  tier: 1,
  severity: "error",
  check(segment, ctx) {
    const text = segment.text;
    const m = CASE01.exec(text);
    if (!m) return [];

    // Check if the containing token is in allowedTokens
    // Find the token (maximal non-whitespace sequence) that contains this match
    const matchStart = m.index;
    const matchEnd = m.index + m[0].length;

    // Find token boundaries
    let tokenStart = matchStart;
    while (tokenStart > 0 && !/\s/.test(text[tokenStart - 1])) tokenStart--;
    let tokenEnd = matchEnd;
    while (tokenEnd < text.length && !/\s/.test(text[tokenEnd])) tokenEnd++;

    const token = text.slice(tokenStart, tokenEnd);

    // Skip if token contains placeholders (formula/URL)
    if (
      token.includes(FORMULA_PLACEHOLDER) ||
      token.includes(URL_PLACEHOLDER) ||
      token.includes(CMS_PLACEHOLDER)
    )
      return [];

    if (isAllowedToken(token, ctx)) return [];

    return [
      finding(
        this.id,
        segment,
        m[0],
        m.index,
        `Uppercase letter between two lowercase letters inside a word: "${m[0]}" in "${token}".`,
        "Fix the casing — this is likely a corruption from a regex edit or translation tool.",
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// TYPO-CASE-02: Lowercase sentence start after sentence-ending punctuation inside a paragraph
// Pattern: [.!?]\s+\p{Ll}
// Exclusions: preceding token is a known abbreviation for the file locale;
//   preceding token is ...; preceding token is a digit sequence (\d+)
// ---------------------------------------------------------------------------

const CASE02 = /[.!?]\s+\p{Ll}/gu;

const case02: TypographyRule = {
  id: "TYPO-CASE-02",
  family: "CASE",
  tier: 1,
  severity: "error",
  check(segment, ctx) {
    const text = segment.text;
    for (const m of text.matchAll(CASE02)) {
      const punctIndex = m.index;

      // Find the token before the punctuation
      // Scan backwards to find the token (maximal non-whitespace before punct)
      let tokenEnd = punctIndex;
      while (tokenEnd > 0 && /\s/.test(text[tokenEnd - 1])) tokenEnd--;
      let tokenStart = tokenEnd;
      while (tokenStart > 0 && !/\s/.test(text[tokenStart - 1])) tokenStart--;

      const token = text.slice(tokenStart, tokenEnd);

      // Exclusion: preceding token is a known abbreviation
      if (ctx.abbreviations.has(token)) continue;

      // Exclusion: text ending at the punctuation matches a multi-word abbreviation
      // (e.g. "z. B." — the period at punctIndex is part of the abbreviation)
      // Also check text including the matched characters, for abbreviations like
      // "u. a." where the first period triggers the match but the abbreviation
      // continues past the matched lowercase letter
      const textUpToPunct = text.slice(0, punctIndex + 1);
      const textUpToMatch = text.slice(0, m.index + m[0].length + 1);
      let isAbbrev = false;
      for (const abbr of ctx.abbreviations) {
        if (textUpToPunct.endsWith(abbr) || textUpToMatch.endsWith(abbr)) {
          isAbbrev = true;
          break;
        }
      }
      if (isAbbrev) continue;

      // Exclusion: preceding token is "..."
      if (token === "...") continue;

      // Exclusion: preceding token is a digit sequence
      if (/^\d+$/.test(token)) continue;

      // Exclusion: preceding token contains a placeholder (formula/URL/CMS)
      if (
        token.includes(FORMULA_PLACEHOLDER) ||
        token.includes(URL_PLACEHOLDER) ||
        token.includes(CMS_PLACEHOLDER)
      )
        continue;

      return [
        finding(
          this.id,
          segment,
          m[0],
          m.index,
          "Lowercase sentence start after sentence-ending punctuation.",
          "Capitalize the first letter of the sentence.",
        ),
      ];
    }
    return [];
  },
};

// ---------------------------------------------------------------------------
// TYPO-LOCALE-01: Mixed-script word (Latin and Cyrillic letters in one token)
// Pattern: token matches both \p{Script=Latin} and \p{Script=Cyrillic}
// Exclusions: Latin parts of hyphenated tokens in typography.allowedTokens
// ---------------------------------------------------------------------------

const LATIN_SCRIPT = /\p{Script=Latin}/u;
const CYRILLIC_SCRIPT = /\p{Script=Cyrillic}/u;

const LATIN_ONLY = /^[\p{Script=Latin}0-9.]+$/u;
const HAS_LATIN_LETTER = /\p{Script=Latin}/u;

function extractLatinParts(token: string): string[] {
  const parts = token.split("-");
  return parts
    .map((p) => p.replace(/[^\p{Script=Latin}0-9.]/gu, ""))
    .filter((p) => p.length > 0 && LATIN_ONLY.test(p) && HAS_LATIN_LETTER.test(p));
}

const locale01: TypographyRule = {
  id: "TYPO-LOCALE-01",
  family: "LOCALE",
  tier: 1,
  severity: "error",
  check(segment, ctx) {
    const tokens = tokenize(segment.text);
    for (const token of tokens) {
      // Skip tokens with placeholders
      if (
        token.includes(FORMULA_PLACEHOLDER) ||
        token.includes(URL_PLACEHOLDER) ||
        token.includes(CMS_PLACEHOLDER)
      )
        continue;
      if (LATIN_SCRIPT.test(token) && CYRILLIC_SCRIPT.test(token)) {
        // Check if all Latin parts are in allowedTokens
        const latinParts = extractLatinParts(token);
        if (latinParts.length > 0 && latinParts.every((p) => ctx.allowedTokens.has(p))) {
          continue;
        }
        return [
          finding(
            this.id,
            segment,
            token,
            segment.text.indexOf(token),
            `Mixed-script word (Latin and Cyrillic letters in one token): "${token}".`,
            "Separate scripts — this is likely a homoglyph or translation artifact.",
          ),
        ];
      }
    }
    return [];
  },
};

// ---------------------------------------------------------------------------
// TYPO-LOCALE-02: Foreign-alphabet letters for a Cyrillic locale
// Pattern: file locale `uk`: [ыэъёЫЭЪЁ]
// Exclusions: tokens in typography.allowedTokens
// ---------------------------------------------------------------------------

const UK_FOREIGN_LETTERS = /[ыэъёЫЭЪЁ]/u;

const locale02: TypographyRule = {
  id: "TYPO-LOCALE-02",
  family: "LOCALE",
  tier: 1,
  severity: "error",
  check(segment, ctx) {
    if (segment.locale !== "uk") return [];
    const text = segment.text;
    const m = UK_FOREIGN_LETTERS.exec(text);
    if (!m) return [];

    // Check if the containing token is in allowedTokens
    const matchIndex = m.index;
    let tokenStart = matchIndex;
    while (tokenStart > 0 && !/\s/.test(text[tokenStart - 1])) tokenStart--;
    let tokenEnd = matchIndex + 1;
    while (tokenEnd < text.length && !/\s/.test(text[tokenEnd])) tokenEnd++;
    const token = text.slice(tokenStart, tokenEnd);

    if (isAllowedToken(token, ctx)) return [];

    return [
      finding(
        this.id,
        segment,
        m[0],
        m.index,
        `Foreign-alphabet letter "${m[0]}" in a Ukrainian locale (these letters are Russian, not Ukrainian).`,
        "Replace with the Ukrainian equivalent.",
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// TYPO-LOCALE-03: Cyrillic letters in a non-Cyrillic locale
// Pattern: file locale `de`/`en`: \p{Script=Cyrillic}
// Exclusions: tokens in typography.allowedTokens; markdown blockquote lines (lines starting with >)
// ---------------------------------------------------------------------------

const locale03: TypographyRule = {
  id: "TYPO-LOCALE-03",
  family: "LOCALE",
  tier: 1,
  severity: "error",
  check(segment, ctx) {
    if (segment.locale === "uk") return [];
    const text = segment.text;
    const m = CYRILLIC_SCRIPT.exec(text);
    if (!m) return [];

    // Check if the containing token is in allowedTokens
    const matchIndex = m.index;
    let tokenStart = matchIndex;
    while (tokenStart > 0 && !/\s/.test(text[tokenStart - 1])) tokenStart--;
    let tokenEnd = matchIndex + 1;
    while (tokenEnd < text.length && !/\s/.test(text[tokenEnd])) tokenEnd++;
    const token = text.slice(tokenStart, tokenEnd);

    if (isAllowedToken(token, ctx)) return [];

    // Check if this is a blockquote line (raw starts with >)
    if (segment.source === "body" && /^\s*>/.test(segment.raw)) return [];

    return [
      finding(
        this.id,
        segment,
        m[0],
        m.index,
        `Cyrillic letter "${m[0]}" in a non-Cyrillic locale (${segment.locale}).`,
        "Replace with the Latin equivalent or wrap in a blockquote/fenced block.",
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// TYPO-YAML-02: Odd number of straight double quotes in a text value
// Pattern: count of " in value is odd
// Exclusions: none
// ---------------------------------------------------------------------------

const yaml02: TypographyRule = {
  id: "TYPO-YAML-02",
  family: "YAML",
  tier: 1,
  severity: "error",
  check(segment, _ctx) {
    if (segment.source !== "frontmatter") return [];
    const quoteCount = (segment.raw.match(/"/g) ?? []).length;
    if (quoteCount % 2 !== 0) {
      return [
        finding(
          this.id,
          segment,
          '"',
          0,
          `Odd number of straight double quotes (${quoteCount}) in a text value.`,
          "Balance the quotes — add or remove a double quote.",
        ),
      ];
    }
    return [];
  },
};

// ---------------------------------------------------------------------------
// Export all Tier 1 rules
// ---------------------------------------------------------------------------

export const TIER1_RULES: readonly TypographyRule[] = [
  punct01,
  punct02,
  punct03,
  punct04,
  space01,
  space02,
  space03,
  space04,
  case01,
  case02,
  locale01,
  locale02,
  locale03,
  yaml02,
];

// Note: TYPO-YAML-01 is not a rule function — it is emitted by the command
// adapter when the text-surface extractor returns a non-null yamlError.

export function createTypographyContext(
  locale: string,
  allowedTokens: ReadonlySet<string>,
  abbreviationsOverride?: ReadonlySet<string>,
): TypographyContext {
  const defaults = getLocaleDefaults(locale);
  return {
    locale,
    allowedTokens: new Set([...DEFAULT_ALLOWED_TOKENS, ...allowedTokens]),
    abbreviations: abbreviationsOverride ?? defaults.abbreviations,
    localeDefaults: defaults,
  };
}

export { LOCALE_DEFAULTS, getLocaleDefaults };
