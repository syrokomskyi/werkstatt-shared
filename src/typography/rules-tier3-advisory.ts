/*
<MODULE_CONTRACT>
<purpose>Tier 3 advisory typography rules (RFC-1071). Implements 5 rules across
3 families: UNICODE (2), LINK (2), SENT (1). All rules emit severity: "warning"
and do not block commits. Rules operate on TextSegment objects produced by the
text-surface extractor (RFC-1068). UNICODE rules check segment.text; LINK rules
check segment.raw (which preserves markdown link syntax stripped from segment.text);
SENT rules check segment.text via splitSentences.</purpose>
<non-goals>
  <item>Do not extract text — that is text-surface.ts.</item>
  <item>Do not handle file I/O or command registration — that is the command adapter.</item>
  <item>Do not auto-fix — autofix is RFC-1072.</item>
  <item>Do not validate Tier 1 or Tier 2 rules — that is rules-tier1.ts and rules-tier2-*.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1071: initial creation with 5 Tier 3 advisory rules.</item>
</CHANGE_SUMMARY>
*/

import type { TextSegment } from "./text-surface.ts";
import { finding, type TypographyFinding, type TypographyRule } from "./rules-tier1.ts";
import { splitSentences } from "../semantic/extract.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tier3AdvisoryRuleId = `TYPO-${"UNICODE" | "LINK" | "SENT"}-${string}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INLINE_CODE_SPAN = /`[^`]*`/g;

function stripInlineCodeSpans(raw: string): string {
  return raw.replace(INLINE_CODE_SPAN, "");
}

function countWords(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  let count = 0;
  for (const word of words) {
    const stripped = word.replace(/\p{P}/gu, "");
    if (stripped.length > 0) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// TYPO-UNICODE-01: Zero-width characters
// ---------------------------------------------------------------------------

const ZERO_WIDTH = /[\u200B\u200C\u200D\uFEFF]/gu;

const UNICODE_01: TypographyRule = {
  id: "TYPO-UNICODE-01",
  family: "UNICODE",
  tier: 3,
  severity: "warning",
  check(segment: TextSegment): TypographyFinding[] {
    const findings: TypographyFinding[] = [];
    let match: RegExpExecArray | null;
    const regex = new RegExp(ZERO_WIDTH.source, "gu");
    while ((match = regex.exec(segment.text)) !== null) {
      const charName =
        match[0] === "\u200B"
          ? "U+200B (zero-width space)"
          : match[0] === "\u200C"
            ? "U+200C (zero-width non-joiner)"
            : match[0] === "\u200D"
              ? "U+200D (zero-width joiner)"
              : "U+FEFF (zero-width no-break space / BOM)";
      findings.push(
        finding(
          "TYPO-UNICODE-01",
          segment,
          match[0],
          match.index,
          `Invisible character ${charName} in text.`,
          "Remove the zero-width character from the source.",
        ),
      );
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// TYPO-UNICODE-02: Soft hyphen (U+00AD)
// ---------------------------------------------------------------------------

const SOFT_HYPHEN = /\u00AD/gu;

const UNICODE_02: TypographyRule = {
  id: "TYPO-UNICODE-02",
  family: "UNICODE",
  tier: 3,
  severity: "warning",
  check(segment: TextSegment): TypographyFinding[] {
    const findings: TypographyFinding[] = [];
    let match: RegExpExecArray | null;
    const regex = new RegExp(SOFT_HYPHEN.source, "gu");
    while ((match = regex.exec(segment.text)) !== null) {
      findings.push(
        finding(
          "TYPO-UNICODE-02",
          segment,
          match[0],
          match.index,
          "Soft hyphen (U+00AD) in text — invisible in most editors but affects rendering.",
          "Remove the soft hyphen from the source.",
        ),
      );
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// TYPO-LINK-01: Link text is a bare URL
// ---------------------------------------------------------------------------

const BARE_URL_LINK = /\[https?:\/\/[^\]]+\]\(/giu;

const LINK_01: TypographyRule = {
  id: "TYPO-LINK-01",
  family: "LINK",
  tier: 3,
  severity: "warning",
  check(segment: TextSegment): TypographyFinding[] {
    if (segment.source !== "body") return [];
    const findings: TypographyFinding[] = [];
    const cleaned = stripInlineCodeSpans(segment.raw);
    let match: RegExpExecArray | null;
    const regex = new RegExp(BARE_URL_LINK.source, "giu");
    while ((match = regex.exec(cleaned)) !== null) {
      findings.push(
        finding(
          "TYPO-LINK-01",
          segment,
          match[0],
          match.index,
          "Link text is a bare URL — use descriptive link text instead.",
          "Replace the URL in link text with a descriptive phrase.",
        ),
      );
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// TYPO-LINK-02: Link text is a generic phrase
// ---------------------------------------------------------------------------

const LINK_TEXT_EXTRACTOR = /\[([^\]]+)\]\([^)]*\)/gu;
const GENERIC_LINK_PHRASES = /^(click here|hier klicken|тут|here|hier)$/i;

const LINK_02: TypographyRule = {
  id: "TYPO-LINK-02",
  family: "LINK",
  tier: 3,
  severity: "warning",
  check(segment: TextSegment): TypographyFinding[] {
    if (segment.source !== "body") return [];
    const findings: TypographyFinding[] = [];
    const cleaned = stripInlineCodeSpans(segment.raw);
    let match: RegExpExecArray | null;
    const regex = new RegExp(LINK_TEXT_EXTRACTOR.source, "gu");
    while ((match = regex.exec(cleaned)) !== null) {
      const linkText = match[1];
      if (GENERIC_LINK_PHRASES.test(linkText)) {
        findings.push(
          finding(
            "TYPO-LINK-02",
            segment,
            match[0],
            match.index,
            `Link text "${linkText}" is generic — use descriptive link text instead.`,
            `Replace "${linkText}" with a phrase that describes the link target.`,
          ),
        );
      }
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// TYPO-SENT-01: Sentence longer than 40 words
// ---------------------------------------------------------------------------

const SENTENCE_WORD_LIMIT = 40;

const SENT_01: TypographyRule = {
  id: "TYPO-SENT-01",
  family: "SENT",
  tier: 3,
  severity: "warning",
  check(segment: TextSegment): TypographyFinding[] {
    if (segment.source !== "body") return [];
    const findings: TypographyFinding[] = [];
    const sentences = splitSentences(segment.text, segment.locale);
    let searchOffset = 0;
    for (const sentence of sentences) {
      const wordCount = countWords(sentence);
      if (wordCount > SENTENCE_WORD_LIMIT) {
        const sentenceStart = segment.text.indexOf(sentence, searchOffset);
        const column = sentenceStart >= 0 ? sentenceStart : 0;
        if (sentenceStart >= 0) searchOffset = sentenceStart + sentence.length;
        findings.push(
          finding(
            "TYPO-SENT-01",
            segment,
            sentence,
            column,
            `Sentence has ${wordCount} words (limit: ${SENTENCE_WORD_LIMIT}) — consider splitting for readability.`,
            "Split the long sentence into shorter ones.",
          ),
        );
      }
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const TIER3_ADVISORY_RULES: readonly TypographyRule[] = [
  UNICODE_01,
  UNICODE_02,
  LINK_01,
  LINK_02,
  SENT_01,
];
