/*
<MODULE_CONTRACT>
<purpose>RFC-1305 AC-1/AC-2 probes for capDiagnostics/capStrings — capped lists carry the TRUNC-01 marker with total/cap/hidden; at-cap lists pass through unchanged.</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1305: initial tests.</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";

import { capDiagnostics, capStrings, TRUNC_RULE_ID } from "./diagnostic-cap.ts";
import type { Diagnostic } from "./diagnostic.ts";

const diag = (i: number): Diagnostic => ({
  ruleId: "GRAM-01",
  severity: "error",
  message: `finding ${i}`,
});

describe("capDiagnostics", () => {
  it("AC-1: over-cap list yields exactly cap items + one trailing TRUNC-01 with total/cap/hidden", () => {
    const items = Array.from({ length: 301 }, (_, i) => diag(i));
    const out = capDiagnostics(items, 300, "GRAM-01");
    expect(out.length).toBe(301);
    const marker = out[300]!;
    expect(marker.ruleId).toBe(TRUNC_RULE_ID);
    expect(marker.severity).toBe("warning");
    expect(marker.data).toEqual({
      cappedRule: "GRAM-01",
      total: 301,
      cap: 300,
      hidden: 1,
    });
    expect(marker.message).toContain("301");
    expect(marker.message).toContain("300");
  });

  it("AC-2: at-cap list passes through unchanged — no marker", () => {
    const items = Array.from({ length: 5 }, (_, i) => diag(i));
    const out = capDiagnostics(items, 5, "GRAM-01");
    expect(out).toEqual(items);
    expect(out.some((d) => d.ruleId === TRUNC_RULE_ID)).toBe(false);
  });

  it("opts.total overrides items.length for early-break collectors", () => {
    const items = Array.from({ length: 200 }, (_, i) => diag(i));
    const out = capDiagnostics(items, 200, "TERM-01", { total: 437 });
    expect(out.length).toBe(201);
    const marker = out[200]!;
    expect(marker.ruleId).toBe(TRUNC_RULE_ID);
    expect(marker.data).toMatchObject({ cappedRule: "TERM-01", total: 437, cap: 200, hidden: 237 });
  });
});

describe("capStrings", () => {
  it("string envelopes get the greppable TRUNC-01 marker line with total and cap", () => {
    const items = Array.from({ length: 51 }, (_, i) => `[ERROR] violation ${i}`);
    const out = capStrings(items, 50, "DIST-REF-02");
    expect(out.length).toBe(51);
    expect(out[50]).toContain(TRUNC_RULE_ID);
    expect(out[50]).toContain("51");
    expect(out[50]).toContain("50");
    expect(out[50]).toContain("DIST-REF-02");
  });

  it("at-cap string list passes through unchanged", () => {
    const items = ["[ERROR] a", "[ERROR] b"];
    expect(capStrings(items, 50, "X-01")).toEqual(items);
  });
});
