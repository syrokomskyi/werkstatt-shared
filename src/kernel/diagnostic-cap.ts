/*
<MODULE_CONTRACT>
<purpose>Shared diagnostic-list capping primitives (RFC-1305): every capped findings list must end with a TRUNC-01 truncation marker naming the true total and the cap — never a bare slice, never a marker borrowing the capped rule's own id.</purpose>

<non-goals>
  <item>Does not bound message-content truncation inside diagnostic strings (e.g. stderr slices, excerpt shortening) — same defect class, different surface; deferred per RFC-1305 nonGoals.</item>
  <item>Does not choose caps — call sites keep their own cap values.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>is always warning-severity regardless of the capped rule's severity</item>
  <item>opts.total lets early-break collectors report the true filtered count</item>
  <item>capStrings is the string-envelope adapter for the RFC-1305 sweep's non-Diagnostic emission paths (import.extensions.lint, price.presence.validate, need.markers.validate, dist.faq.validate, dist.content-references.validate, content.idempotency.validate)</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1305: initial implementation — capDiagnostics (Diagnostic[] path) + capStrings (string-envelope path), both emitting the shared TRUNC-01 marker.</item>
  <item>RFC-1305 review-r1: opts.total floored at items.length — an under-counted total can never emit more than cap items silently.</item>
</CHANGE_SUMMARY>
*/

import type { Diagnostic } from "./diagnostic.ts";

/** Rule id carried by every truncation marker — greppable as one defect class. */
export const TRUNC_RULE_ID = "TRUNC-01";

export interface CapInfo {
  /** The rule whose findings were capped (e.g. "GRAM-01"). */
  cappedRule: string;
  /** True filtered total — the count that would have been listed. */
  total: number;
  /** The applied cap. */
  cap: number;
  /** Findings hidden by the cap: total - cap. */
  hidden: number;
}

/**
 * Cap a Diagnostic list: `items.slice(0, cap)` plus — when the true total
 * exceeds the cap — one trailing TRUNC-01 warning diagnostic carrying
 * `{ cappedRule, total, cap, hidden }` (RFC-1305). `opts.total` overrides the
 * total for collectors that break early; it must be the filtered count that
 * would have been listed, never the raw scan count.
 */
export function capDiagnostics<T extends Diagnostic>(
  items: T[],
  cap: number,
  ruleId: string,
  opts?: { total?: number; detail?: Record<string, unknown> },
): (T | Diagnostic)[] {
  // Floor at items.length — a caller passing a stale/under-counted opts.total
  // must never emit more than cap items silently.
  const total = Math.max(items.length, opts?.total ?? items.length);
  if (total <= cap) return items;
  const info: CapInfo = { cappedRule: ruleId, total, cap, hidden: total - cap };
  return [
    ...items.slice(0, cap),
    {
      ruleId: TRUNC_RULE_ID,
      severity: "warning",
      message: `${total} findings exceeded cap ${cap}; showing first ${cap} (capped rule ${ruleId}).`,
      data: { ...opts?.detail, ...info },
    },
  ];
}

/**
 * String-envelope adapter for commands that emit rendered violation lines
 * (failResult string lists) rather than Diagnostic objects — appends the same
 * TRUNC-01 marker as a line so the class stays greppable (RFC-1305).
 */
export function capStrings(
  items: string[],
  cap: number,
  ruleId: string,
  opts?: { total?: number },
): string[] {
  const total = Math.max(items.length, opts?.total ?? items.length);
  if (total <= cap) return items;
  return [
    ...items.slice(0, cap),
    `[${TRUNC_RULE_ID}] ${total} findings exceeded cap ${cap}; showing first ${cap} (capped rule ${ruleId}).`,
  ];
}
