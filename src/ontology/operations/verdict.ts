/*
<MODULE_CONTRACT>
<purpose>
  RFC-1458: werkstatt:verdict/v1 — the requirement-mapped verdict record
  emitted by deploy.smoke.run for site-smoke.yaml routes tagged with
  `requirement: RFC-XXXX/AC-N`, persisted per release under
  releases/&lt;releaseId&gt;/.test-evidence/verdicts.json, and ingested by
  rfc.verification.emit as external-origin evidence.
</purpose>
<non-goals>
  <item>No emission logic — deploy.smoke.run (werkstatt-site) owns writing records.</item>
  <item>No ingestion logic — forge's rfc.verification.emit owns matching and ranking.</item>
  <item>No gating — a verdict is an evidence record; no gate may read it.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>channel is the closed dev/alt/main union — the same vocabulary deploy-execution uses.</item>
  <item>detail is bounded at the schema boundary (300 chars) — consumers can rely on the bound.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1458: initial — VerdictEvent schema, requirement tag pattern, boundedDetail.</item>
  <item>RFC-1458: emit requirement-mapped verdict events from deploy.smoke.run</item>
  <item>RFC-1485: sweep compass headers — shared-tail</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

export const VERDICT_SCHEMA = "werkstatt:verdict/v1";

/** `RFC-XXXX/AC-N` tag shape enforced on site-smoke.yaml `requirement` fields. */
export const REQUIREMENT_TAG_PATTERN = /^RFC-\d{4}\/AC-\d+$/;

export const VERDICT_DETAIL_MAX = 300;
export const VERDICT_DETAIL_TRUNCATED = "…[truncated]";

/**
 * Bound a detail string to VERDICT_DETAIL_MAX characters — the marker is
 * part of the budget. Producers MUST pass observations through here; the
 * field never carries response bodies, headers, cookies, or tokens.
 */
export function boundedDetail(value: string, max = VERDICT_DETAIL_MAX): string {
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - VERDICT_DETAIL_TRUNCATED.length)) + VERDICT_DETAIL_TRUNCATED;
}

export const verdictOutcomeSchema = z.enum(["pass", "fail", "inconclusive"]);
export type VerdictOutcome = z.infer<typeof verdictOutcomeSchema>;

export const verdictChannelSchema = z.enum(["dev", "alt", "main"]);
export type VerdictChannel = z.infer<typeof verdictChannelSchema>;

export const verdictEventSchema = z.object({
  schema: z.literal(VERDICT_SCHEMA),
  /** `RFC-XXXX/AC-N` — the acceptance criterion the observation addresses. */
  requirement: z.string().regex(REQUIREMENT_TAG_PATTERN, "requirement must match RFC-XXXX/AC-N"),
  /** Executed check kind, e.g. "route-status", "console-errors", "pageerror", "requestfailed". */
  check: z.string().min(1),
  outcome: verdictOutcomeSchema,
  releaseId: z.string().min(1),
  site: z.string().min(1),
  channel: verdictChannelSchema,
  /** ISO-8601 observation timestamp. */
  observedAt: z.string().min(1),
  /** Bounded observation — never bodies, headers, cookies, tokens, or visitor data. */
  detail: z.string().max(VERDICT_DETAIL_MAX).optional(),
});

export type VerdictEvent = z.infer<typeof verdictEventSchema>;
