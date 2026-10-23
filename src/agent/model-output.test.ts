/*
<MODULE_CONTRACT>
<purpose>
Unit tests for RFC-1371's model-output boundary — stripModelJsonFence,
modelAuthored two-tier posture, and parseModelJson's fence→parse→validate
pipeline. Guards the documented contract: authored extra keys strip (AC-2),
identity-bearing .strict() structures fail closed (AC-3), wrong-typed required
fields fail closed (AC-4), already-parsed values pass through to the schema.
</purpose>
<non-goals>
  <item>Do not test consumer seams — visual-review/asset-quality own theirs.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1371: initial test matrix — fence variants, two-tier posture, typed boundary result.</item>
  <item>RFC-1371: implement rfc-1371 — shared parseModelJson boundary at both vision seams</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, test } from "vitest";
import { z } from "zod";

import { modelAuthored, parseModelJson, stripModelJsonFence } from "./model-output.ts";

describe("stripModelJsonFence", () => {
  test("bare JSON passes through", () => {
    expect(JSON.parse(stripModelJsonFence('{"a":1}'))).toEqual({ a: 1 });
  });
  test("json-fenced and bare-fenced blocks strip", () => {
    expect(JSON.parse(stripModelJsonFence('```json\n{"a":1}\n```\n'))).toEqual({ a: 1 });
    expect(JSON.parse(stripModelJsonFence('```\n{"a":1}\n```'))).toEqual({ a: 1 });
  });
  test("non-fenced prose is returned untouched", () => {
    expect(stripModelJsonFence("not json at all")).toBe("not json at all");
  });
});

describe("modelAuthored", () => {
  const finding = modelAuthored({
    criterion: z.string(),
    fix: modelAuthored({ target: z.string() }),
  });

  test("AC-2 — extra key inside an authored subobject validates and strips", () => {
    const parsed = finding.safeParse({
      criterion: "c",
      fix: { target: "t" },
      fix_note: "model decoration",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({ criterion: "c", fix: { target: "t" } });
  });

  test("AC-3 — identity-bearing .strict() structure rejects an unrequested key", () => {
    const scores = z.object({ contrast: z.object({ score: z.number() }) }).strict();
    const parsed = scores.safeParse({ contrast: { score: 4 }, invented: { score: 5 } });
    expect(parsed.success).toBe(false);
  });

  test("AC-4 — wrong-typed required field fails closed, never coerced", () => {
    const parsed = finding.safeParse({ criterion: 42, fix: { target: "t" } });
    expect(parsed.success).toBe(false);
  });
});

describe("parseModelJson", () => {
  const schema = modelAuthored({ pass: z.boolean(), reason: z.string() });

  test("parses fenced model text", () => {
    const r = parseModelJson('```json\n{"pass":true,"reason":"ok","extra":1}\n```', schema);
    expect(r).toEqual({ ok: true, value: { pass: true, reason: "ok" } });
  });

  test("parses bare model text", () => {
    const r = parseModelJson('{"pass":false,"reason":"blurry"}', schema);
    expect(r).toEqual({ ok: true, value: { pass: false, reason: "blurry" } });
  });

  test("already-parsed values validate without re-parsing", () => {
    const r = parseModelJson({ pass: true, reason: "ok" }, schema);
    expect(r).toEqual({ ok: true, value: { pass: true, reason: "ok" } });
  });

  test("unparsable text returns ok:false with the JSON error", () => {
    const r = parseModelJson("not json at all", schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });

  test("schema-invalid payload returns ok:false with the first issue", () => {
    const r = parseModelJson({ pass: "yes", reason: "x" }, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("boolean");
  });
});
