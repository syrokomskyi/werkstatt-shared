/*
<MODULE_CONTRACT>
<purpose>RFC-1397 AC-3/AC-5 probes for isShipInFlight — journal-derived in-flight detection, stale degradation, ignoreOpId exemption, torn-line fail-closed.</purpose>
<non-goals>
  <item>No command-level guard tests — refusal/skip behavior lives in the engine and forge suites.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1397: initial tests.</item>
  <item>RFC-1397: guard mission lifecycle moves during in-flight ship operations (RFC-1397)</item>
  <item>RFC-1399: bound post-deploy dev mission.check to a 20-URL fidelity sample on matching same-artifact certify evidence</item>
</CHANGE_SUMMARY>
*/

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { appendRecord, TornLineError, type JournalRecord } from "./journal.ts";
import { isShipInFlight, SHIP_INFLIGHT_STALE_MS } from "./ship-inflight.ts";

const SYSTEM_ID = "test-sys";
const MISSION_ID = "test-sys-m000999";

let tmpRoot: string;
let workspaceRoot: string;
let journalPath: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ship-inflight-"));
  // Convention: workspaceRoot is a child of tmpRoot; systems-cache is its sibling.
  workspaceRoot = path.join(tmpRoot, "werkstatt");
  journalPath = path.join(
    tmpRoot,
    "systems-cache",
    SYSTEM_ID,
    "operations",
    `ship-${MISSION_ID}.jsonl`,
  );
  await fs.mkdir(path.dirname(journalPath), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

const rec = (r: JournalRecord) => appendRecord(journalPath, r);

const opStarted = (opId: string, at: string): JournalRecord => ({
  kind: "op-started",
  opId,
  op: "leitstand.ship",
  missionId: MISSION_ID,
  at,
  platformVersion: "6.418.6",
});

describe("isShipInFlight", () => {
  it("AC-5: open journal → inFlight with opId/lastStep/startedAt", async () => {
    await rec(opStarted("op-aaa", "2026-10-25T10:00:00.000Z"));
    await rec({
      kind: "step-started",
      opId: "op-aaa",
      step: "certify-dev",
      seq: 3,
      at: "2026-10-25T10:05:00.000Z",
    });
    const res = await isShipInFlight(workspaceRoot, SYSTEM_ID, MISSION_ID, undefined, {
      // frozen journal times need a frozen `now` — otherwise the stale window
      // (6h) drifts past the fixture and the assertion time-bombs.
      now: "2026-10-25T10:30:00.000Z",
    });
    expect(res.inFlight).toBe(true);
    expect(res.stale).toBe(false);
    expect(res.opId).toBe("op-aaa");
    expect(res.op).toBe("leitstand.ship");
    expect(res.startedAt).toBe("2026-10-25T10:00:00.000Z");
    expect(res.lastStep).toBe("certify-dev");
    expect(res.lastActivityAt).toBe("2026-10-25T10:05:00.000Z");
  });

  it("AC-5: closed journal (op-done) → inFlight false", async () => {
    await rec(opStarted("op-aaa", "2026-10-25T10:00:00.000Z"));
    await rec({ kind: "op-done", opId: "op-aaa", at: "2026-10-25T12:00:00.000Z" });
    const res = await isShipInFlight(workspaceRoot, SYSTEM_ID, MISSION_ID);
    expect(res).toEqual({ inFlight: false, stale: false });
  });

  it("AC-5: missing journal → inFlight false", async () => {
    const res = await isShipInFlight(workspaceRoot, SYSTEM_ID, "test-sys-m000777");
    expect(res).toEqual({ inFlight: false, stale: false });
  });

  it("AC-5: abandoned op → inFlight false", async () => {
    await rec(opStarted("op-aaa", "2026-10-25T10:00:00.000Z"));
    await rec({
      kind: "op-abandoned",
      opId: "op-aaa",
      at: "2026-10-25T11:00:00.000Z",
      reason: "superseded",
    });
    const res = await isShipInFlight(workspaceRoot, SYSTEM_ID, MISSION_ID);
    expect(res.inFlight).toBe(false);
  });

  it("AC-4: ignoreOpId exempts the caller's own op", async () => {
    await rec(opStarted("op-self", "2026-10-25T10:00:00.000Z"));
    const res = await isShipInFlight(workspaceRoot, SYSTEM_ID, MISSION_ID, undefined, {
      ignoreOpId: "op-self",
    });
    expect(res.inFlight).toBe(false);
  });

  it("AC-3: newest record older than 6h → stale true, still inFlight", async () => {
    await rec(opStarted("op-old", "2026-10-25T01:00:00.000Z"));
    const res = await isShipInFlight(workspaceRoot, SYSTEM_ID, MISSION_ID, undefined, {
      now: "2026-10-25T10:00:00.000Z",
    });
    expect(res.inFlight).toBe(true);
    expect(res.stale).toBe(true);
  });

  it("AC-3: boundary — newest record just under 6h → stale false", async () => {
    await rec(opStarted("op-edge", "2026-10-25T04:30:00.000Z"));
    const res = await isShipInFlight(workspaceRoot, SYSTEM_ID, MISSION_ID, undefined, {
      now: "2026-10-25T10:00:00.000Z",
      staleAfterMs: SHIP_INFLIGHT_STALE_MS,
    });
    expect(res.stale).toBe(false);
  });

  it("interrupted op (step-failed) stays inFlight with failedStep", async () => {
    await rec(opStarted("op-fail", "2026-10-25T10:00:00.000Z"));
    await rec({
      kind: "step-failed",
      opId: "op-fail",
      step: "deploy-alt",
      seq: 7,
      at: "2026-10-25T10:10:00.000Z",
      error: "boom",
    });
    const res = await isShipInFlight(workspaceRoot, SYSTEM_ID, MISSION_ID);
    expect(res.inFlight).toBe(true);
    expect(res.failedStep).toBe("deploy-alt");
    expect(res.lastStep).toBe("deploy-alt");
  });

  it("torn final line → TornLineError propagates (fail closed)", async () => {
    await rec(opStarted("op-aaa", "2026-10-25T10:00:00.000Z"));
    await fs.appendFile(journalPath, '{"kind":"step-');
    await expect(isShipInFlight(workspaceRoot, SYSTEM_ID, MISSION_ID)).rejects.toThrow(
      TornLineError,
    );
  });
});
