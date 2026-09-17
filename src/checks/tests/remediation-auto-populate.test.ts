/*
<MODULE_CONTRACT>
  <purpose>RFC-1027: unit tests for diagnosticsResult() remediation auto-population.</purpose>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1027: initial tests for remediation auto-population from REMEDIATION_CATALOG.</item>
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
