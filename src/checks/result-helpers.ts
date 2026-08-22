/*
<MODULE_CONTRACT>
<purpose>
RFC-0203 canonical result builders. Every builder returns a CheckResult
(`{ command, status, diagnostics, summary }`) so non-zero exits propagate to CI
and the central failure printer renders findings uniformly. The string builders
(passResult/failResult/resultFromViolations) key each violation to a coarse
ruleId = command; diagnosticsResult takes rich Diagnostic[] with registered ids.
</purpose>
<non-goals>
  <item>Do not interpret violation severity — string builders emit error-severity diagnostics; failResult always exits 1.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0029 review: Initial creation to fix systemic exit-code bug across check files.</item>
</CHANGE_SUMMARY>
*/

import type {
  CheckResult,
  Diagnostic,
  KernelCommandResult,
  KernelNextStep,
} from "@warpgogol/werkstatt/kernel";

function defaultFailNextSteps(command: string): KernelNextStep[] {
  return [
    {
      action: `Fix the error diagnostics reported by ${command} above, then re-run the pipeline`,
      kind: "required",
    },
  ];
}

/**
 * Format error/warning counts with proper pluralization and zero-omission.
 *
 * - `0, 0` → `""` (empty string — caller should omit)
 * - `1, 0` → `"1 error"`
 * - `0, 1` → `"1 warning"`
 * - `2, 0` → `"2 errors"`
 * - `2, 1` → `"2 errors, 1 warning"`
 */
export function formatCounts(errors: number, warnings: number): string {
  const parts: string[] = [];
  if (errors > 0) {
    parts.push(`${errors} error${errors === 1 ? "" : "s"}`);
  }
  if (warnings > 0) {
    parts.push(`${warnings} warning${warnings === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}

/**
 * RFC-0203: canonical result builder. Migrated checks emit `Diagnostic[]` with
 * registered rule ids instead of bare strings. Exit code is 1 when any
 * diagnostic is an error; warnings and info do not fail the pipeline.
 *
 * When `nextSteps` are not provided and the result has errors, a default
 * agent-actionable nextStep is emitted: "Fix the error diagnostics … then
 * re-run the pipeline".
 */
export function diagnosticsResult(
  command: string,
  diagnostics: Diagnostic[],
  nextSteps?: KernelNextStep[],
): KernelCommandResult<CheckResult> {
  const summary = {
    error: diagnostics.filter((d) => d.severity === "error").length,
    warning: diagnostics.filter((d) => d.severity === "warning").length,
    info: diagnostics.filter((d) => d.severity === "info").length,
  };
  const status: CheckResult["status"] =
    summary.error > 0 ? "fail" : summary.warning > 0 ? "warn" : "pass";
  const resolvedNextSteps =
    nextSteps ?? (summary.error > 0 ? defaultFailNextSteps(command) : undefined);
  const counts = formatCounts(summary.error, summary.warning);
  return {
    data: { command, status, diagnostics, summary },
    exitCode: summary.error > 0 ? 1 : 0,
    summary: counts ? `[${command}] ${counts}` : `[${command}]`,
    nextSteps: resolvedNextSteps,
  };
}

/**
 * RFC-0203: map bare violation strings into canonical error Diagnostics. The
 * command name is the coarse, stable ruleId for these single-rule checks; checks
 * that need finer ids or fixHints use {@link diagnosticsResult} directly.
 */
function violationsToDiagnostics(command: string, violations: string[]): Diagnostic[] {
  return violations.map((message) => ({ ruleId: command, severity: "error" as const, message }));
}

function emptySummary(): CheckResult["summary"] {
  return { error: 0, warning: 0, info: 0 };
}

/**
 * Canonical success result. RFC-0203: emits an empty `CheckResult` (no
 * diagnostics) rather than the legacy `{ command, status, violations }` shape.
 */
export function passResult(
  command: string,
  summary?: string,
  nextSteps?: KernelNextStep[],
): KernelCommandResult<CheckResult> {
  return {
    data: { command, status: "pass", diagnostics: [], summary: emptySummary() },
    exitCode: 0,
    summary: summary ?? `[${command}] OK`,
    nextSteps,
  };
}

/**
 * Canonical failure result — always exits 1 (preserving the historical
 * failResult contract). RFC-0203: violation strings become error Diagnostics
 * keyed by the command name.
 *
 * When `nextSteps` are not provided, a default agent-actionable nextStep is
 * emitted: "Fix the error diagnostics … then re-run the pipeline".
 */
export function failResult(
  command: string,
  violations: string[],
  nextSteps?: KernelNextStep[],
): KernelCommandResult<CheckResult> {
  const diagnostics = violationsToDiagnostics(command, violations);
  return {
    data: {
      command,
      status: "fail",
      diagnostics,
      summary: { error: diagnostics.length, warning: 0, info: 0 },
    },
    exitCode: 1,
    summary: `[${command}] ${violations.length} violation${violations.length === 1 ? "" : "s"}`,
    nextSteps: nextSteps ?? defaultFailNextSteps(command),
  };
}

/**
 * Build a canonical result from a violations array — pass if empty, fail
 * otherwise. RFC-0203: no longer a bare-string shim; it emits canonical
 * Diagnostics (ruleId = command). Checks that need registered fine-grained
 * ruleIds, locators, or fixHints use {@link diagnosticsResult} instead.
 */
export function resultFromViolations(
  command: string,
  violations: string[],
  nextSteps?: KernelNextStep[],
): KernelCommandResult<CheckResult> {
  return violations.length > 0 ? failResult(command, violations, nextSteps) : passResult(command);
}
