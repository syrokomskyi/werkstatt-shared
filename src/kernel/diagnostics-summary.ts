/**
 * <MODULE_CONTRACT>
 *   <purpose>RFC-1296: summarize per-step diagnostics from command result data
 *            into counts consumable by validation-report.json — warnings must
 *            not be dropped when a step passes.</purpose>
 *   <role>Kernel / shared</role>
 *   <consumers>mission-materialization-commands.ts, validation-report.json consumers</consumers>
 *   <change_rules>
 *     <item>Recognized shapes are fixed by the RFC-1296 contract — extend only
 *           additively (new shape branches appended after existing ones).</item>
 *   </change_rules>
 * <non-goals>
  <item>Not a contract source of truth — callers depend on the module's exported API, not this file's internals.</item>
</non-goals>
</MODULE_CONTRACT>
 <CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — repairs pre-existing contract debt surfaced by the test-file scaffold rollout.</item>
</CHANGE_SUMMARY>
*/

export interface DiagnosticsSummary {
  errors: number;
  warnings: number;
  rules: Record<string, { error: number; warning: number }>;
}

interface DiagnosticLike {
  ruleId?: string;
  severity?: string;
}

function isDiagnosticArray(value: unknown): value is DiagnosticLike[] {
  return (
    Array.isArray(value) &&
    value.every((d) => typeof d === "object" && d !== null && !Array.isArray(d) && "severity" in d)
  );
}

function countInto(
  summary: DiagnosticsSummary,
  diagnostics: readonly DiagnosticLike[],
): DiagnosticsSummary {
  for (const d of diagnostics) {
    if (d.severity !== "error" && d.severity !== "warning") continue; // info/notice not counted
    const ruleId = typeof d.ruleId === "string" && d.ruleId ? d.ruleId : "(no-rule)";
    const bucket = (summary.rules[ruleId] ??= { error: 0, warning: 0 });
    if (d.severity === "error") {
      summary.errors += 1;
      bucket.error += 1;
    } else {
      summary.warnings += 1;
      bucket.warning += 1;
    }
  }
  return summary;
}

function countStrings(summary: DiagnosticsSummary, diagnostics: readonly string[]): void {
  for (const _ of diagnostics) {
    summary.errors += 1;
    const bucket = (summary.rules["(untyped)"] ??= { error: 0, warning: 0 });
    bucket.error += 1;
  }
}

/**
 * Extract `{ errors, warnings, rules }` from any command result `data` shape
 * used in the workshop. Recognized shapes, first match wins:
 *
 * 1. `data.findings: DiagnosticLike[]` (audit results, `buildAuditResult`)
 * 2. `data.diagnostics: DiagnosticLike[]` (`diagnosticsResult`)
 * 3. `data.result?.diagnostics: DiagnosticLike[]` (nested)
 * 4. `data.diagnostics: string[]` — counted as errors only when `exitCode != 0`,
 *    under ruleId `"(untyped)"`
 *
 * Any other shape returns zeros.
 */
export function summarizeStepDiagnostics(data: unknown, exitCode?: number): DiagnosticsSummary {
  const summary: DiagnosticsSummary = { errors: 0, warnings: 0, rules: {} };
  if (typeof data !== "object" || data === null) return summary;
  const record = data as Record<string, unknown>;

  // Shape 1: audit findings
  if (isDiagnosticArray(record.findings)) {
    return countInto(summary, record.findings);
  }

  // Shape 2: flat diagnostics
  if (isDiagnosticArray(record.diagnostics)) {
    return countInto(summary, record.diagnostics);
  }

  // Shape 3: nested result.diagnostics
  const nested = record.result;
  if (
    typeof nested === "object" &&
    nested !== null &&
    isDiagnosticArray((nested as Record<string, unknown>).diagnostics)
  ) {
    return countInto(summary, (nested as Record<string, unknown>).diagnostics as DiagnosticLike[]);
  }

  // Shape 4: untyped string diagnostics — errors only on non-zero exit
  if (Array.isArray(record.diagnostics) && record.diagnostics.every((d) => typeof d === "string")) {
    if (exitCode !== undefined && exitCode !== 0) {
      countStrings(summary, record.diagnostics as string[]);
    }
    return summary;
  }

  return summary;
}
