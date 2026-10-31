/*
<MODULE_CONTRACT>
<purpose>RFC-1463: runCompositeGate — the shared complete-reporting runner for
composite gates. Executes declared steps in dependency order; a failed step
records its diagnostics and every independent successor still runs, while
ordering-dependent successors record `skipped: dependency-failed` with the
blocking step id. The gate verdict fails when any step failed, but the run
always reaches every independent step — a gate never spends an agent
round-trip on information it already possessed.</purpose>
<non-goals>
  <item>No step reordering — declaration order is the pipeline owner's, the runner only changes failure semantics.</item>
  <item>No auto-remediation — steps decide their own fixes; the runner only aggregates outcomes.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>Three-state step records — pass / fail / skipped are counted separately; a skipped step carries `blockedBy` (the dependency id that failed) so a bare skip count is never a debugging dead end.</item>
  <item>dependsOn transitively taints — a step whose dependency chain contains a failed or skipped step is itself skipped (skipped chains report the nearest blocking ancestor).</item>
  <item>failFast is the explicit escape for debugging — the default run always reaches every independent step.</item>
</KEY_DECISIONS>
</MODULE_CONTRACT>
*/

import type { Diagnostic } from "./diagnostic.ts";

export interface CompositeStepOutcome {
  status: "pass" | "fail";
  diagnostics?: Diagnostic[];
}

export interface CompositeGateStep {
  /** Stable step id — appears in records and `blockedBy` references. */
  id: string;
  /**
   * Ordering dependencies: a failed or skipped dependency marks this step
   * `skipped` (never run). Steps without a failed/skipped ancestor are
   * independent and always execute, even after earlier failures.
   */
  dependsOn?: string[];
  run: () => Promise<CompositeStepOutcome>;
}

export interface CompositeStepRecord {
  id: string;
  status: "pass" | "fail" | "skipped";
  diagnostics: Diagnostic[];
  /** Set when status === "skipped" — the dependency step id that blocked the run. */
  blockedBy?: string;
  durationMs: number;
}

export interface CompositeGateResult {
  /** true when no step failed — skipped steps alone do not fail the gate (their blockers did). */
  ok: boolean;
  /** Step records in declaration order — the complete violation set, not a prefix. */
  steps: CompositeStepRecord[];
  summary: { pass: number; fail: number; skipped: number };
}

export interface CompositeGateOptions {
  /** RFC-1463 escape hatch — abort the run at the first failing step. */
  failFast?: boolean;
}

/**
 * RFC-1463: run a composite gate — every independent step executes in one
 * invocation; dependent successors skip with an explicit blockedBy marker.
 */
export async function runCompositeGate(
  steps: CompositeGateStep[],
  options: CompositeGateOptions = {},
): Promise<CompositeGateResult> {
  const records: CompositeStepRecord[] = [];
  const statusById = new Map<string, "pass" | "fail" | "skipped">();
  const blockedById = new Map<string, string>();

  for (const step of steps) {
    if (options.failFast === true && statusOf(records, "fail") > 0) break;

    const blocker = (step.dependsOn ?? []).find((dep) => statusById.get(dep) !== "pass");
    if (blocker !== undefined) {
      // The nearest blocking ancestor — the dependency's own blocker when the
      // dependency was itself skipped — so the marker names the real failure.
      const rootBlocker = blockedById.get(blocker) ?? blocker;
      records.push({
        id: step.id,
        status: "skipped",
        diagnostics: [],
        blockedBy: rootBlocker,
        durationMs: 0,
      });
      statusById.set(step.id, "skipped");
      blockedById.set(step.id, rootBlocker);
      continue;
    }

    const startedAt = performance.now();
    const outcome = await step.run();
    records.push({
      id: step.id,
      status: outcome.status,
      diagnostics: outcome.diagnostics ?? [],
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    });
    statusById.set(step.id, outcome.status);
  }

  return {
    ok: statusOf(records, "fail") === 0,
    steps: records,
    summary: {
      pass: statusOf(records, "pass"),
      fail: statusOf(records, "fail"),
      skipped: statusOf(records, "skipped"),
    },
  };
}

function statusOf(records: CompositeStepRecord[], status: CompositeStepRecord["status"]): number {
  return records.reduce((n, r) => (r.status === status ? n + 1 : n), 0);
}
