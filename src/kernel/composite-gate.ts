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
  <item>Three-state step records — a skipped step carries `blockedBy` (the root failed dependency id).</item>
  <item>dependsOn transitively taints — skipped chains report the root failing step, not the nearest ancestor.</item>
  <item>The dependsOn graph is pre-validated — a missing or later-declared reference throws rather than false-greening.</item>
  <item>A throwing step records `fail` with the exception — one bad step never aborts the complete-set contract.</item>
  <item>failFast is the explicit escape for debugging — the default run always reaches every independent step.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1485: sweep compass headers — shared-tail</item>
</CHANGE_SUMMARY>
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
 * Thrown when the declared step graph is malformed — a `dependsOn` naming a
 * step id that does not exist or points forward in declaration order (which
 * also covers cycles: every cycle contains at least one forward reference).
 * This is a declaration defect, never a runtime failure — the runner refuses
 * rather than silently skipping every dependent step into a false green.
 */
export class CompositeGateGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompositeGateGraphError";
  }
}

function assertValidStepGraph(steps: CompositeGateStep[]): void {
  const seen = new Set<string>();
  for (const step of steps) {
    if (seen.has(step.id)) {
      throw new CompositeGateGraphError(
        `composite gate declares step id "${step.id}" twice — ids must be unique`,
      );
    }
    for (const dep of step.dependsOn ?? []) {
      if (!seen.has(dep)) {
        throw new CompositeGateGraphError(
          `composite gate step "${step.id}" dependsOn "${dep}" — the id is unknown ` +
            `or declared later than this step (steps run in declaration order; ` +
            `dependencies must point backward)`,
        );
      }
    }
    seen.add(step.id);
  }
}

/**
 * RFC-1463: run a composite gate — every independent step executes in one
 * invocation; dependent successors skip with an explicit blockedBy marker.
 */
export async function runCompositeGate(
  steps: CompositeGateStep[],
  options: CompositeGateOptions = {},
): Promise<CompositeGateResult> {
  assertValidStepGraph(steps);
  const records: CompositeStepRecord[] = [];
  const statusById = new Map<string, "pass" | "fail" | "skipped">();
  const blockedById = new Map<string, string>();

  for (const step of steps) {
    if (options.failFast === true && statusOf(records, "fail") > 0) break;

    const blocker = (step.dependsOn ?? []).find((dep) => statusById.get(dep) !== "pass");
    if (blocker !== undefined) {
      // The root blocker — the dependency's own blocker when the dependency
      // was itself skipped — so the marker names the real failure.
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
    let outcome: CompositeStepOutcome;
    try {
      outcome = await step.run();
    } catch (error) {
      outcome = {
        status: "fail",
        diagnostics: [
          {
            ruleId: "GATE-CMP-02",
            severity: "error",
            message: `step "${step.id}" threw: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
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
