/*
<MODULE_CONTRACT>
<purpose>
Unit tests for diagnostics summary covering summarizeStepDiagnostics. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the diagnostics suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";

import { summarizeStepDiagnostics } from "./diagnostics-summary.ts";

describe("summarizeStepDiagnostics", () => {
  it("counts data.findings warnings per rule id (AC-1)", () => {
    const summary = summarizeStepDiagnostics({
      findings: [
        { ruleId: "TERMS-DRIFT-01", severity: "warning" },
        { ruleId: "TERMS-DRIFT-01", severity: "warning" },
        { ruleId: "DIST-LEAK-06", severity: "error" },
        { ruleId: "LOCALFACT-01", severity: "info" },
      ],
    });
    expect(summary.warnings).toBe(2);
    expect(summary.errors).toBe(1);
    expect(summary.rules["TERMS-DRIFT-01"]).toEqual({ error: 0, warning: 2 });
    expect(summary.rules["DIST-LEAK-06"]).toEqual({ error: 1, warning: 0 });
    expect(summary.rules["LOCALFACT-01"]).toBeUndefined();
  });

  it("counts data.diagnostics object array (diagnosticsResult shape)", () => {
    const summary = summarizeStepDiagnostics({
      diagnostics: [
        { ruleId: "LP-01", severity: "warning" },
        { severity: "error" },
      ],
    });
    expect(summary.warnings).toBe(1);
    expect(summary.errors).toBe(1);
    expect(summary.rules["(no-rule)"]).toEqual({ error: 1, warning: 0 });
  });

  it("counts data.result.diagnostics (nested shape)", () => {
    const summary = summarizeStepDiagnostics({
      result: { diagnostics: [{ ruleId: "X-01", severity: "warning" }] },
    });
    expect(summary.warnings).toBe(1);
    expect(summary.rules["X-01"]).toEqual({ error: 0, warning: 1 });
  });

  it("counts string diagnostics as (untyped) errors only on non-zero exit", () => {
    const failed = summarizeStepDiagnostics({ diagnostics: ["boom", "bam"] }, 1);
    expect(failed.errors).toBe(2);
    expect(failed.rules["(untyped)"]).toEqual({ error: 2, warning: 0 });

    const passed = summarizeStepDiagnostics({ diagnostics: ["note"] }, 0);
    expect(passed.errors).toBe(0);
    expect(passed.rules["(untyped)"]).toBeUndefined();
  });

  it("returns zeros for unrecognized shapes", () => {
    for (const data of [undefined, null, {}, { diagnostics: "nope" }, 42, []]) {
      expect(summarizeStepDiagnostics(data)).toEqual({ errors: 0, warnings: 0, rules: {} });
    }
  });
});
