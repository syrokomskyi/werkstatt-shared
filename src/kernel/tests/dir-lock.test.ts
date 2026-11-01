/*
<MODULE_CONTRACT>
  <purpose>
dir-lock.test unit coverage for acquireDirLock — the RFC-1376 contract: exclusive claim,
ordered waiter wake-up, dead-holder reclaim via pid liveness, stale-marker
reclaim via mtime, and DirLockTimeoutError carrying holder context.
</purpose>
  <non-goals>
    <item>Do not cover the playwright.chromium.ensure integration — that lives in werkstatt-site checks/tests.</item>
  </non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1376: initial coverage — claim/exclusion/reclaim/timeout contract.</item>
  <item>RFC-1376: serialize playwright browser installs via dir-lock</item>
  <item>RFC-1485: sweep compass headers — shared-tail</item>
</CHANGE_SUMMARY>
*/

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { describe, expect, test } from "vitest";
import { acquireDirLock, DirLockTimeoutError } from "../dir-lock.ts";
import { createDefaultIO } from "../workspace-io.ts";

const io = createDefaultIO().io;

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "dir-lock-"));
}

async function lockExists(lockPath: string): Promise<boolean> {
  return fs
    .stat(lockPath)
    .then(() => true)
    .catch(() => false);
}

describe("acquireDirLock", () => {
  test("claim writes an owner-<pid> marker and release removes the lock", async () => {
    const dir = await makeTmpDir();
    try {
      const lockPath = path.join(dir, ".test.lock");
      const lock = await acquireDirLock(lockPath, io);
      expect(await lockExists(lockPath)).toBe(true);
      const entries = await fs.readdir(lockPath);
      expect(entries).toContain(`owner-${process.pid}`);
      await lock.release();
      expect(await lockExists(lockPath)).toBe(false);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("a second claimant waits, then acquires after release", async () => {
    const dir = await makeTmpDir();
    try {
      const lockPath = path.join(dir, ".test.lock");
      const first = await acquireDirLock(lockPath, io);
      let acquiredSecond = false;
      const secondPromise = acquireDirLock(lockPath, io, { pollMs: 20 }).then((l) => {
        acquiredSecond = true;
        return l;
      });
      await new Promise((r) => setTimeout(r, 80));
      expect(acquiredSecond).toBe(false);
      await first.release();
      const second = await secondPromise;
      expect(acquiredSecond).toBe(true);
      await second.release();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("dead holder (ESRCH pid) is reclaimed without waiting", async () => {
    const dir = await makeTmpDir();
    try {
      const lockPath = path.join(dir, ".test.lock");
      // Simulate a crashed holder: lock dir + marker for an implausible pid.
      await fs.mkdir(lockPath);
      await fs.mkdir(path.join(lockPath, "owner-999999999"));
      const lock = await acquireDirLock(lockPath, io, { timeoutMs: 1_000 });
      expect((await fs.readdir(lockPath))).toContain(`owner-${process.pid}`);
      await lock.release();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("markerless lock past staleMs is reclaimed", async () => {
    const dir = await makeTmpDir();
    try {
      const lockPath = path.join(dir, ".test.lock");
      await fs.mkdir(lockPath);
      const old = new Date(Date.now() - 60_000);
      await fs.utimes(lockPath, old, old);
      const lock = await acquireDirLock(lockPath, io, { timeoutMs: 1_000, staleMs: 30_000 });
      await lock.release();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("live holder past the wait bound throws DirLockTimeoutError naming the pid", async () => {
    const dir = await makeTmpDir();
    try {
      const lockPath = path.join(dir, ".test.lock");
      await fs.mkdir(lockPath);
      await fs.mkdir(path.join(lockPath, `owner-${process.pid}`)); // alive — this process
      const err = await acquireDirLock(lockPath, io, { timeoutMs: 60, pollMs: 20 }).catch(
        (e) => e,
      );
      expect(err).toBeInstanceOf(DirLockTimeoutError);
      expect((err as DirLockTimeoutError).holder.pid).toBe(process.pid);
      expect((err as DirLockTimeoutError).holder.lockPath).toBe(lockPath);
      expect((err as Error).message).toContain(String(process.pid));
      expect(await lockExists(lockPath)).toBe(true); // live lock left untouched
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
