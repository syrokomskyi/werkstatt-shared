/*
<MODULE_CONTRACT>
<purpose>Mechanical fix engine for typography violations (RFC-1072). Provides the
FixAction discriminated union, the FIXABLE_RULE_IDS whitelist, and the applyFixes
pure function that transforms findings into fixed segment text. Only rules
whitelisted in FIXABLE_RULE_IDS populate the fix field on TypographyFinding.</purpose>
<non-goals>
  <item>Do not read or write files — that is the command adapter in werkstatt-site.</item>
  <item>Do not run convergence guards — the command adapter re-runs typography.validate.</item>
  <item>Do not fix rules outside the whitelist — those require human judgment.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1072: initial creation with FixAction type, FIXABLE_RULE_IDS, and applyFixes.</item>
</CHANGE_SUMMARY>
*/

import type { TextSegment } from "./text-surface.ts";
import type { TypographyFinding, TypographyContext } from "./rules-tier1.ts";

// ---------------------------------------------------------------------------
// FixAction: discriminated union for mechanical fix actions
// ---------------------------------------------------------------------------

/**
 * Discriminated union for mechanical fix actions.
 * Stored on `TypographyFinding.fix` (replacing `null` from RFC-1068).
 * Only rules whitelisted in FIXABLE_RULE_IDS populate this field;
 * all other rules keep `fix: null`.
 */
export type FixAction =
  | { type: "replace"; old: string; new: string }
  | { type: "insert"; at: number; text: string }
  | { type: "delete"; at: number; length: number };

// ---------------------------------------------------------------------------
// Whitelist of fixable rule IDs (RFC-1072)
// ---------------------------------------------------------------------------

/**
 * Rules that are safe for mechanical fixing. Only PUNCT, SPACE, APOS, and ABBR
 * families are fixable — other families require human judgment.
 */
export const FIXABLE_RULE_IDS: readonly string[] = [
  "TYPO-PUNCT-01",
  "TYPO-SPACE-01",
  "TYPO-SPACE-02",
  "TYPO-APOS-01",
  "TYPO-APOS-02",
  "TYPO-ABBR-01",
  "TYPO-ABBR-02",
] as const;

const FIXABLE_SET: ReadonlySet<string> = new Set(FIXABLE_RULE_IDS);

/**
 * Check if a rule ID is in the fixable whitelist.
 */
export function isFixable(ruleId: string): boolean {
  return FIXABLE_SET.has(ruleId);
}

// ---------------------------------------------------------------------------
// Segment identity key (for Map<TextSegment, string>)
// ---------------------------------------------------------------------------

function segmentKey(segment: TextSegment): string {
  return `${segment.file}:${segment.line}:${segment.path}`;
}

// ---------------------------------------------------------------------------
// Apply a single fix action to segment text
// ---------------------------------------------------------------------------

function applyAction(text: string, action: FixAction, column: number): string {
  switch (action.type) {
    case "replace": {
      // Replace the match at the given column
      const before = text.slice(0, column);
      const after = text.slice(column + action.old.length);
      return before + action.new + after;
    }
    case "insert": {
      // Insert text at the specified position (relative to segment text)
      const before = text.slice(0, action.at);
      const after = text.slice(action.at);
      return before + action.text + after;
    }
    case "delete": {
      // Delete `length` characters starting at `at`
      const before = text.slice(0, action.at);
      const after = text.slice(action.at + action.length);
      return before + after;
    }
  }
}

// ---------------------------------------------------------------------------
// applyFixes: apply all fixes to findings, returning fixed segment text
// ---------------------------------------------------------------------------

/**
 * Apply mechanical fixes to findings. Each finding must have a non-null `fix`
 * (populated by the rule when whitelisted in FIXABLE_RULE_IDS).
 *
 * The function groups findings by segment, then applies all fixes within a
 * segment in reverse column order (to avoid offset shifts). Returns a Map keyed
 * by segment identity, with the full fixed segment text as the value.
 *
 * Findings with `fix: null` (non-whitelisted rules) are skipped.
 */
export function applyFixes(
  findings: TypographyFinding[],
  _context: TypographyContext,
): { fixedSegments: Map<string, string>; fixCount: number } {
  // Group findings by segment key
  const bySegment = new Map<string, { segment: TextSegment; findings: TypographyFinding[] }>();

  for (const f of findings) {
    if (f.fix === null) continue;
    const key = segmentKey(f.segment);
    let entry = bySegment.get(key);
    if (!entry) {
      entry = { segment: f.segment, findings: [] };
      bySegment.set(key, entry);
    }
    entry.findings.push(f);
  }

  const fixedSegments = new Map<string, string>();
  let fixCount = 0;

  for (const [key, { segment, findings: segFindings }] of bySegment) {
    // Sort findings by column in descending order to apply from right to left
    const sorted = [...segFindings].sort((a, b) => b.column - a.column);

    let text = segment.text;
    for (const f of sorted) {
      if (f.fix === null) continue;
      text = applyAction(text, f.fix, f.column);
      fixCount++;
    }

    fixedSegments.set(key, text);
  }

  return { fixedSegments, fixCount };
}
