/*
<MODULE_CONTRACT>
  <purpose>operation journal record types and JSONL core — JournalRecord union, OperationStep/OperationDefinition contracts, readJournal/appendRecord, findIncompleteOperation, TornLineError (RFC-0958). Sunk from @warpgogol/werkstatt-engine/src/journal/{types,jsonl}.ts by RFC-1397 so both the engine and autonomous forge modules share one implementation.</purpose>
  <non-goals>
    <item>No mission-specific types — the journal is pure infrastructure.</item>
    <item>No step execution or journal orchestration — runner.ts and sweep.ts stay in the engine.</item>
  </non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1397: sunk from engine src/journal/{types,jsonl}.ts unchanged — single source for the ship-in-flight guard shared by engine and forge (FORGE-AUTONOMY-01 exemption).</item>
  <item>RFC-1397: guard mission lifecycle moves during in-flight ship operations (RFC-1397)</item>
  <item>RFC-1485: sweep compass headers — shared-tail</item>
</CHANGE_SUMMARY>
*/

import path from "node:path";
import { createDefaultIO, type WorkspaceIO } from "./workspace-io.ts";

export type JournalRecord =
  | {
      kind: "op-started";
      opId: string;
      op: string;
      missionId: string;
      at: string;
      platformVersion: string;
      // RFC-1387: the release an op was started to continue — journaled at
      // op-start so a flag-less --resume can rebuild the resolve-shaped plan
      // even when the op failed before release-resolve step-done existed.
      releaseId?: string;
    }
  | { kind: "step-started"; opId: string; step: string; seq: number; at: string }
  | {
      kind: "step-done";
      opId: string;
      step: string;
      seq: number;
      at: string;
      meta?: Record<string, unknown>;
    }
  | { kind: "step-failed"; opId: string; step: string; seq: number; at: string; error: string }
  | {
      kind: "step-skipped";
      opId: string;
      step: string;
      seq: number;
      at: string;
      reason: "already-satisfied" | "resume";
    }
  | { kind: "op-done"; opId: string; at: string }
  | { kind: "op-abandoned"; opId: string; at: string; reason: string }
  // RFC-1219: non-terminal marker — the op stopped on a failed step and is
  // resumable. Older readers ignore the unknown kind and still see the op as
  // open; findIncompleteOperation treats it as non-terminal either way.
  | { kind: "op-interrupted"; opId: string; at: string; failedStep: string };

export interface OperationStep<C> {
  name: string;
  run(ctx: C): Promise<void | Record<string, unknown>>;
  verify?(ctx: C): Promise<boolean>;
}

export interface OperationDefinition<C> {
  op: string;
  steps: OperationStep<C>[];
}

export interface StepResult {
  step: string;
  status: "done" | "skipped" | "failed";
  durationMs: number;
  meta?: Record<string, unknown>;
}

export interface RunOperationResult {
  opId: string;
  completed: boolean;
  failedStep?: string;
  failedStepError?: string;
  skipped: string[];
  executed: string[];
  stepResults: StepResult[];
}

export async function appendRecord(
  journalPath: string,
  record: JournalRecord,
  io: WorkspaceIO = createDefaultIO().io,
): Promise<void> {
  const dir = path.dirname(journalPath);
  if (!(await io.exists(dir))) {
    await io.mkdir(dir);
  }
  const line = JSON.stringify(record) + "\n";
  await io.appendFile(journalPath, line);
}

export class TornLineError extends Error {
  constructor(
    message: string,
    readonly lineNumber: number,
    readonly rawLine: string,
  ) {
    super(message);
    this.name = "TornLineError";
  }
}

function isRecordShape(v: unknown): v is JournalRecord {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as JournalRecord).kind === "string"
  );
}

export async function readJournal(
  journalPath: string,
  io: WorkspaceIO = createDefaultIO().io,
): Promise<JournalRecord[]> {
  if (!(await io.exists(journalPath))) {
    return [];
  }
  const content = await io.readFile(journalPath);
  if (content.length === 0) {
    return [];
  }
  const lines = content.split("\n");
  const records: JournalRecord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0) {
      continue;
    }

    try {
      const parsed: unknown = JSON.parse(line);
      // A line that parses but is not a record (42, null, "str", [], {})
      // is corruption too — it must not enter the record set, where it
      // poisons every consumer iterating r.kind/r.opId (RFC-1394 CX-2:
      // a null line crashed findIncompleteOperation with TypeError).
      if (!isRecordShape(parsed)) {
        throw new SyntaxError("journal line is not a record");
      }
      records.push(parsed);
    } catch {
      // INV-journal-05 (declared in werkstatt-engine src/journal/jsonl.ts): a journal cut inside its final non-empty line raises TornLineError naming that line number — torn writes are never silently parsed.
      const isLastNonEmpty =
        i === lines.length - 1 || (i === lines.length - 2 && lines[lines.length - 1].length === 0);
      if (isLastNonEmpty) {
        throw new TornLineError(
          `Torn final line at journal line ${i + 1} — discard or inspect manually: ${line.slice(0, 80)}`,
          i + 1,
          line,
        );
      }
      throw new TornLineError(
        `Corrupt journal line ${i + 1} (not at EOF) — hard error, inspect manually: ${line.slice(0, 80)}`,
        i + 1,
        line,
      );
    }
  }

  return records;
}

export interface IncompleteOperation {
  opId: string;
  op: string;
  lastSeq: number;
  /**
   * RFC-1219: "interrupted" when the op recorded a step-failed or
   * op-interrupted marker (resumable failure) — "running" when the op is
   * open with no failure signal (in-flight or crashed mid-step).
   */
  status: "interrupted" | "running";
  /** Latest failed step for the op, when one was recorded. */
  failedStep?: string;
}

/**
 * RFC-1219: scans every op-started newest→oldest and returns the first op
 * without a terminal record (op-done / op-abandoned). op-interrupted is a
 * non-terminal marker and does not close an op. Previously only the last
 * op-started was inspected — a completed later op masked an earlier
 * incomplete one (warpgogol-m000192 class of failure).
 */
// INV-journal-03 (declared in werkstatt-engine src/journal/jsonl.ts): returns an incomplete op whenever one exists — the newest op-started without a terminal record, so a completed later op never masks an earlier incomplete one.
export function findIncompleteOperation(records: JournalRecord[]): IncompleteOperation | null {
  const terminalOpIds = new Set(
    records.filter((r) => r.kind === "op-done" || r.kind === "op-abandoned").map((r) => r.opId),
  );

  const opStarted = records.filter((r) => r.kind === "op-started");
  for (let i = opStarted.length - 1; i >= 0; i--) {
    const started = opStarted[i];
    if (terminalOpIds.has(started.opId)) {
      continue;
    }

    let lastSeq = -1;
    let failedStep: string | undefined;
    for (const r of records) {
      if (r.opId !== started.opId) continue;
      if (
        (r.kind === "step-started" ||
          r.kind === "step-done" ||
          r.kind === "step-failed" ||
          r.kind === "step-skipped") &&
        r.seq > lastSeq
      ) {
        lastSeq = r.seq;
      }
      if (r.kind === "step-failed" || r.kind === "op-interrupted") {
        failedStep = r.kind === "step-failed" ? r.step : r.failedStep;
      }
    }

    return {
      opId: started.opId,
      op: started.op,
      lastSeq,
      status: failedStep !== undefined ? "interrupted" : "running",
      ...(failedStep !== undefined ? { failedStep } : {}),
    };
  }

  return null;
}
