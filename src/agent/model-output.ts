/*
<MODULE_CONTRACT>
<purpose>
RFC-1371: model-output boundary normalizer. Model output is not schema output —
Claude decorates authored subobjects with harmless extra keys and occasionally
wraps JSON in a markdown fence. This module owns the deterministic two-tier
read-side normalization every LLM-output seam consumes: fence strip → JSON
parse → schema validation. Authored subobjects declare modelAuthored()
(unknown keys strip); identity-bearing structures declare .strict() (an
unrequested key fails closed). Leniency is key-shape only — wrong-typed
required fields still fail closed, and persisted artifacts keep .strict().
</purpose>
<non-goals>
  <item>Never coerce wrong-typed fields into the schema.</item>
  <item>Never strip at a blanket path list — the schema encodes the tiers.</item>
  <item>No provider transport — callers own fetch/retry and pass raw output.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1371: initial implementation — stripModelJsonFence, modelAuthored marker, parseModelJson tri-state boundary.</item>
  <item>RFC-1371: implement rfc-1371 — shared parseModelJson boundary at both vision seams</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

/**
 * Claude occasionally wraps JSON in a fenced block — strip it before parsing.
 * Reference semantics moved from werkstatt-site/onboarding/asset-quality.ts.
 */
export function stripModelJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "");
}

/**
 * RFC-1371: marks a model-authored subobject — unknown keys are decoration and
 * zod's default strip removes them before validation. Explicit so "deliberately
 * lenient" is greppable and never confused with a forgotten `.strict()`.
 * Identity-bearing structures (key→id maps like the `scores` criterion map)
 * declare `.strict()` instead — an unrequested key is a contract violation.
 */
export function modelAuthored<T extends z.ZodRawShape>(
  shape: T,
): z.ZodObject<T> {
  return z.object(shape);
}

export type ParseModelJsonResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * RFC-1371: the single LLM-output parse boundary — fence strip → JSON.parse →
 * schema.safeParse. `raw` may be the model's text output or an already-parsed
 * value (reviewer deps return parsed-or-text); either way the schema gate runs
 * identically. Failure `error` is the JSON.parse message or the first zod
 * issue message — never throws on model input.
 */
export function parseModelJson<T>(
  raw: unknown,
  schema: z.ZodType<T>,
): ParseModelJsonResult<T> {
  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(stripModelJsonFence(raw));
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
  const parsed = schema.safeParse(candidate);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: parsed.error.issues[0]?.message ?? "invalid shape" };
}
