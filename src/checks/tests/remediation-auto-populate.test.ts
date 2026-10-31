/*
<MODULE_CONTRACT>
  <purpose>
Unit tests for remediation auto populate covering its documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1027: initial tests for remediation auto-population from REMEDIATION_CATALOG.</item>
  <item>RFC-1461: bind blocking diagnostics to remediation entries and print their remedy (RFC-1461)

Add diagnostic.explain lookup, severity-aware strict coverage (REMEDIATION-03/04), per-error remedy/lookup nextSteps, contract-bearing catalog seeds for every error-severity ruleId, and regenerated manifests.</item>
</CHANGE_SUMMARY>
*/

import { test, expect } from "vitest";
import { diagnosticsResult } from "../result-helpers.ts";
import type { Diagnostic } from "@warpgogol/werkstatt-shared/kernel";

test("diagnosticsResult: auto-populates remediation from catalog for known ruleId", () => {
  const diagnostics: Diagnostic[] = [
    {
      ruleId: "GEN-FILES-01",
      severity: "error",
      message: "Generated file is stale",
    },
  ];
  const result = diagnosticsResult("test.command", diagnostics);
  expect(result.data!.diagnostics[0].remediation).toBeDefined();
  expect(result.data!.diagnostics[0].remediation?.ruleId).toBe("GEN-FILES-01");
  expect(result.data!.diagnostics[0].remediation?.action).toContain("Regenerate");
  expect(result.data!.diagnostics[0].remediation?.docRef).toBe(
    "docs/authoring/generated-files-and-templates.md",
  );
});

test("diagnosticsResult: does not overwrite existing remediation field", () => {
  const diagnostics: Diagnostic[] = [
    {
      ruleId: "GEN-FILES-01",
      severity: "error",
      message: "Stale file",
      remediation: {
        ruleId: "GEN-FILES-01",
        action: "Custom action — do not overwrite",
      },
    },
  ];
  const result = diagnosticsResult("test.command", diagnostics);
  expect(result.data!.diagnostics[0].remediation?.action).toBe("Custom action — do not overwrite");
});

test("diagnosticsResult: no remediation for unknown ruleId", () => {
  const diagnostics: Diagnostic[] = [
    {
      ruleId: "UNKNOWN-RULE-999",
      severity: "warning",
      message: "Some warning",
    },
  ];
  const result = diagnosticsResult("test.command", diagnostics);
  expect(result.data!.diagnostics[0].remediation).toBeUndefined();
});

test("diagnosticsResult: preserves fixHint alongside remediation", () => {
  const diagnostics: Diagnostic[] = [
    {
      ruleId: "GEN-FILES-01",
      severity: "error",
      message: "Stale",
      fixHint: "Run the generator",
    },
  ];
  const result = diagnosticsResult("test.command", diagnostics);
  expect(result.data!.diagnostics[0].fixHint).toBe("Run the generator");
  expect(result.data!.diagnostics[0].remediation).toBeDefined();
});

test("diagnosticsResult: multiple diagnostics get independent remediation", () => {
  const diagnostics: Diagnostic[] = [
    { ruleId: "GEN-FILES-01", severity: "error", message: "err 1" },
    { ruleId: "PARITY-SECTION-COUNT", severity: "error", message: "err 2" },
    { ruleId: "UNKNOWN", severity: "info", message: "info 1" },
  ];
  const result = diagnosticsResult("test.command", diagnostics);
  expect(result.data!.diagnostics[0].remediation?.ruleId).toBe("GEN-FILES-01");
  expect(result.data!.diagnostics[1].remediation?.ruleId).toBe("PARITY-SECTION-COUNT");
  expect(result.data!.diagnostics[2].remediation).toBeUndefined();
});

test("diagnosticsResult: covered error ruleId prints the catalog remedy as a nextStep (RFC-1461)", () => {
  const diagnostics: Diagnostic[] = [
    { ruleId: "GEN-FILES-01", severity: "error", message: "Stale file" },
  ];
  const result = diagnosticsResult("test.command", diagnostics);
  const remedySteps = result.nextSteps!.map((s) => s.action);
  expect(remedySteps.some((a) => a.includes("Regenerate"))).toBe(true);
  expect(result.nextSteps!.every((s) => s.kind === "required")).toBe(true);
});

test("diagnosticsResult: uncovered error ruleId prints the diagnostic.explain lookup (RFC-1461)", () => {
  const diagnostics: Diagnostic[] = [
    { ruleId: "UNKNOWN-RULE-999", severity: "error", message: "Boom" },
  ];
  const result = diagnosticsResult("test.command", diagnostics);
  expect(result.nextSteps).toContainEqual({
    action: "werkstatt run diagnostic.explain --rule UNKNOWN-RULE-999",
    kind: "required",
  });
});

test("diagnosticsResult: each error ruleId contributes one nextStep; warnings stay silent (RFC-1461)", () => {
  const diagnostics: Diagnostic[] = [
    { ruleId: "UNKNOWN-A", severity: "error", message: "err" },
    { ruleId: "UNKNOWN-A", severity: "error", message: "err again" },
    { ruleId: "UNKNOWN-B", severity: "error", message: "err" },
    { ruleId: "UNKNOWN-C", severity: "warning", message: "warn" },
  ];
  const result = diagnosticsResult("test.command", diagnostics);
  const explainSteps = result.nextSteps!.filter((s) =>
    s.action.startsWith("werkstatt run diagnostic.explain"),
  );
  expect(explainSteps.map((s) => s.action)).toEqual([
    "werkstatt run diagnostic.explain --rule UNKNOWN-A",
    "werkstatt run diagnostic.explain --rule UNKNOWN-B",
  ]);
});
