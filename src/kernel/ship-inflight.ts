/*
<MODULE_CONTRACT>
  <purpose>RFC-1397: ship-in-flight predicate — reports whether a mission's leitstand.ship operation journal holds an incomplete operation. Single implementation consumed by engine lifecycle commands (mission.abort, mission.cleanup) and the autonomous forge mission.archive sweep (werkstatt-shared is exempt from FORGE-AUTONOMY-01).</purpose>
  <non-goals>
    <item>No locking or mutation — the predicate is read-only; the journal stays the authoritative record.</item>
    <item>No mission-journal awareness — only ship journals under systems-cache/operations/ are consulted.</item>
  </non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>Journal-derived, not a lock file — a crashed ship stays visible through the stale window.</item>
  <item>TornLineError propagates — a mid-write journal means callers fail closed instead of guessing.</item>
  <item>ignoreOpId exempts exactly one op — the terminal archive step must not block on itself.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1397: initial implementation — journal-derived in-flight predicate with stale degradation and self-op exemption.</item>
  <item>RFC-1397: guard mission lifecycle moves during in-flight ship operations (RFC-1397)</item>
  <item>RFC-1485: sweep compass headers — shared-tail</item>
</CHANGE_SUMMARY>
*/

import path from "node:path";
import { createDefaultIO, type WorkspaceIO } from "./workspace-io.ts";
import { findIncompleteOperation, readJournal } from "./journal.ts";

/** Incomplete ops older than this degrade to warnings — longer than any real ship. */
export const SHIP_INFLIGHT_STALE_MS = 6 * 60 * 60 * 1000;

export interface ShipInflightResult {
  inFlight: boolean;
  /** Incomplete op is older than SHIP_INFLIGHT_STALE_MS — warn, do not block. */
  stale: boolean;
  opId?: string;
  op?: string;
  startedAt?: string;
  /** Newest `at` across the op's records — basis for staleness. */
  lastActivityAt?: string;
  lastStep?: string;
  failedStep?: string;
}

export interface ShipInflightOptions {
  /** Op to exempt — the caller's own in-flight operation (ship's archive step). */
  ignoreOpId?: string;
  staleAfterMs?: number;
  /** ISO timestamp for staleness evaluation; test seam. */
  now?: string;
}

/**
 * Resolves the ship journal path by workspace convention — mirrors
 * `resolveCacheClonePath` (systems-cache is a sibling of the werkstatt repo).
 */
export function shipJournalPath(
  workspaceRoot: string,
  systemId: string,
  missionId: string,
): string {
  return path.resolve(
    workspaceRoot,
    "..",
    "systems-cache",
    systemId,
    "operations",
    `ship-${missionId}.jsonl`,
  );
}

/**
 * DNA-46 `<system-id>-m<NNNNNN>` contract: resolves the owning system from a
 * mission directory name — works for manifest-less orphan dirs too. Returns
 * null for non-conforming names (callers fall back to mission.yaml).
 */
export function systemIdFromMissionDirName(name: string): string | null {
  const m = /^(.+)-m\d{6}$/.exec(name);
  return m ? m[1] : null;
}

/**
 * Last-resort systemId resolution for sweep callers: ship journals are keyed
 * by missionId under `systems-cache/<systemId>/operations/`, so globbing every
 * system answers the question even for non-conforming dir names. Returns the
 * systemId owning the journal, or null when no journal exists anywhere —
 * which definitively means not in flight.
 */
export async function systemIdFromShipJournals(
  workspaceRoot: string,
  missionId: string,
  io: WorkspaceIO = createDefaultIO().io,
): Promise<string | null> {
  const systemsCacheRoot = path.resolve(workspaceRoot, "..", "systems-cache");
  const hits = await io.glob(`*/operations/ship-${missionId}.jsonl`, {
    cwd: systemsCacheRoot,
  });
  if (hits.length === 0) return null;
  return path.basename(path.dirname(path.dirname(hits[0])));
}

/** Refusal/warning text — SHIP-INFLIGHT-01 blocking, SHIP-INFLIGHT-02 stale. */
export function shipInflightMessage(missionId: string, m: ShipInflightResult): string {
  const ruleId = m.stale ? "SHIP-INFLIGHT-02" : "SHIP-INFLIGHT-01";
  return (
    `${ruleId} mission ${missionId} is being shipped (op ${m.opId}` +
    `${m.lastStep ? `, last step ${m.lastStep}` : ""}` +
    `${m.startedAt ? `, started ${m.startedAt}` : ""})` +
    ` — wait for leitstand.ship to finish, or resume it with leitstand.ship --resume`
  );
}

export async function isShipInFlight(
  workspaceRoot: string,
  systemId: string,
  missionId: string,
  io: WorkspaceIO = createDefaultIO().io,
  opts?: ShipInflightOptions,
): Promise<ShipInflightResult> {
  const journalPath = shipJournalPath(workspaceRoot, systemId, missionId);
  const records = await readJournal(journalPath, io);
  const incomplete = findIncompleteOperation(records);
  if (!incomplete || incomplete.opId === opts?.ignoreOpId) {
    return { inFlight: false, stale: false };
  }

  let startedAt: string | undefined;
  let lastActivityAt: string | undefined;
  let lastStepSeq = -1;
  let lastStep: string | undefined;
  for (const r of records) {
    if (r.opId !== incomplete.opId) continue;
    if (r.kind === "op-started") {
      startedAt = r.at;
    }
    if (lastActivityAt === undefined || r.at > lastActivityAt) {
      lastActivityAt = r.at;
    }
    if (
      (r.kind === "step-started" ||
        r.kind === "step-done" ||
        r.kind === "step-failed" ||
        r.kind === "step-skipped") &&
      r.seq > lastStepSeq
    ) {
      lastStepSeq = r.seq;
      lastStep = r.step;
    }
  }

  const staleAfterMs = opts?.staleAfterMs ?? SHIP_INFLIGHT_STALE_MS;
  const nowMs = opts?.now !== undefined ? Date.parse(opts.now) : Date.now();
  const lastMs = lastActivityAt !== undefined ? Date.parse(lastActivityAt) : nowMs;
  const stale = Number.isFinite(lastMs) ? nowMs - lastMs > staleAfterMs : false;

  return {
    inFlight: true,
    stale,
    opId: incomplete.opId,
    op: incomplete.op,
    ...(startedAt !== undefined ? { startedAt } : {}),
    ...(lastActivityAt !== undefined ? { lastActivityAt } : {}),
    ...(lastStep !== undefined ? { lastStep } : {}),
    ...(incomplete.failedStep !== undefined ? { failedStep: incomplete.failedStep } : {}),
  };
}
