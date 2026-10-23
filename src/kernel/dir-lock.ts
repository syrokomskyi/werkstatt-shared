/*
<MODULE_CONTRACT>
<purpose>
  RFC-1376: cross-process advisory directory lock for shared stores outside
  the workspace (e.g. the ~/.cache/ms-playwright browser store). Extracts the
  gitmesh mkdir-claim convention into a reusable primitive with a bounded
  wait: the claim is an atomic `mkdir` (no -p) through the WorkspaceIO exec
  port — safe under the read-only adapter because it rides `execOnReadOnly`
  while every mutation port (writeFile/mkdir/rm) is closed — and ownership is
  recorded as an `owner-<pid>` directory entry so waiters can probe holder
  liveness via kill(pid, 0).
</purpose>
<non-goals>
  <item>Not a workspace-state lock — gitmesh.sync keeps its own fail-fast acquireLock; this helper serves locks on paths outside the workspace where io.writeFile is unreachable under read-only adapters.</item>
  <item>Not reentrant and not recursive — a process holding a lock must not re-acquire it.</item>
  <item>No shell dependence (no `sh -c`, no `touch`) — all mutations go through `mkdir`/`rm -rf` exec calls or the io.rm port.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>Ownership rides a directory entry (`owner-<pid>`), not a file — writeFile is closed under the read-only adapter, while mkdir-via-exec stays open; readdir is a read op on every adapter.</item>
  <item>Liveness (kill(pid,0)) is primary dead-holder detection; mtime staleness covers only the unprobeable cases (missing marker, EPERM-class probe failures).</item>
  <item>A live holder is never reclaimed regardless of lock age — a multi-minute browser download is legitimate work.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1376: initial implementation — mkdir-claim lock with owner-pid marker, liveness-driven dead-holder reclaim, bounded wait, DirLockTimeoutError carrying holder context.</item>
  <item>RFC-1376: serialize playwright browser installs via dir-lock</item>
</CHANGE_SUMMARY>
*/

import { dirname, join } from "node:path";
import type { WorkspaceIO } from "./workspace-io.ts";

export interface DirLock {
  /** Release the lock directory. Idempotent — safe to call on a vanished lock. */
  release(): Promise<void>;
}

/** Who holds (or last held) the lock — carried on DirLockTimeoutError. */
export interface DirLockHolder {
  /** Owning pid parsed from the `owner-<pid>` marker, null when no marker exists. */
  pid: number | null;
  /** Lock directory path. */
  lockPath: string;
}

export class DirLockTimeoutError extends Error {
  readonly holder: DirLockHolder;
  constructor(lockPath: string, holder: DirLockHolder, timeoutMs: number) {
    super(
      `dir-lock: timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${lockPath}` +
        (holder.pid !== null
          ? ` — held by pid ${holder.pid}`
          : " — holder unknown (no owner marker)"),
    );
    this.name = "DirLockTimeoutError";
    this.holder = holder;
  }
}

export interface AcquireDirLockOptions {
  /** Total wait bound before DirLockTimeoutError. Default 600_000 (10 min). */
  timeoutMs?: number;
  /** Poll interval while waiting. Default 2_000. */
  pollMs?: number;
  /**
   * Mtime staleness threshold applied ONLY when holder liveness cannot be
   * probed (no owner marker or the probe is unreliable). Default 1_200_000.
   */
  staleMs?: number;
  /** Test seam — holder liveness probe. Defaults to `process.kill(pid, 0)`. */
  isAlive?: (pid: number) => boolean;
  /** Test seam — clock. Defaults to Date.now. */
  now?: () => number;
  /** Test seam — sleep. Defaults to a real setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 600_000;
const DEFAULT_POLL_MS = 2_000;
const DEFAULT_STALE_MS = 1_200_000;
const OWNER_PREFIX = "owner-";

function defaultIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // Only ESRCH proves death — anything else (EPERM, platform quirks) means
    // "cannot prove dead", so the holder is treated as alive.
    return (err as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeLockDir(lockPath: string, io: WorkspaceIO): Promise<void> {
  // io.rm first (works on real/recording adapters and Windows); under the
  // read-only adapter it throws KERNEL-META-01, so fall back to `rm -rf`
  // through exec (open when the caller declares execOnReadOnly).
  try {
    await io.rm(lockPath, { recursive: true });
    return;
  } catch {
    /* fall through to exec */
  }
  await io.exec("rm", ["-rf", lockPath]);
}

async function readHolderPid(lockPath: string, io: WorkspaceIO): Promise<number | null> {
  let entries: { name: string }[];
  try {
    entries = await io.readdir(lockPath);
  } catch {
    return null;
  }
  const marker = entries.find((e) => e.name.startsWith(OWNER_PREFIX));
  if (!marker) return null;
  const pid = Number(marker.name.slice(OWNER_PREFIX.length));
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

/**
 * Claim `lockPath` as an advisory cross-process lock, waiting up to
 * `timeoutMs` for a live holder to release. Dead holders (pid gone) are
 * reclaimed; unprobeable holders are reclaimed once the lock dir's mtime
 * exceeds `staleMs`. Throws DirLockTimeoutError when the bound expires.
 */
export async function acquireDirLock(
  lockPath: string,
  io: WorkspaceIO,
  opts: AcquireDirLockOptions = {},
): Promise<DirLock> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
  const staleMs = opts.staleMs ?? DEFAULT_STALE_MS;
  const isAlive = opts.isAlive ?? defaultIsAlive;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? defaultSleep;
  const deadline = now() + timeoutMs;

  // The lock's parent may not exist yet (e.g. first-ever install before the
  // browser store is created) — a bare `mkdir` would fail ENOENT and look
  // indistinguishable from a held lock. `-p` is a no-op when it exists.
  await io.exec("mkdir", ["-p", dirname(lockPath)]);

  for (;;) {
    // Atomic claim — mkdir fails EEXIST while any holder owns the lock.
    const claim = await io.exec("mkdir", [lockPath]);
    if (claim.exitCode === 0) {
      // Record ownership as a directory entry — writeFile is closed under
      // read-only adapters; a second mkdir inside the claimed dir is not.
      await io.exec("mkdir", [join(lockPath, `${OWNER_PREFIX}${process.pid}`)]).catch(() => ({
        exitCode: 1,
        stdout: "",
        stderr: "",
      }));
      let released = false;
      return {
        release: async () => {
          if (released) return;
          released = true;
          await removeLockDir(lockPath, io).catch(() => {});
        },
      };
    }

    // Lock held — decide whether the holder is dead, stale, or live.
    const holder: DirLockHolder = { pid: null, lockPath };
    const exists = await io.exists(lockPath).catch(() => false);
    if (!exists) continue; // released mid-check — retry the claim

    holder.pid = await readHolderPid(lockPath, io);
    let dead = false;
    if (holder.pid !== null) {
      dead = !isAlive(holder.pid);
    } else {
      const stat = await io.stat(lockPath).catch(() => null);
      dead = stat !== null && now() - stat.mtimeMs > staleMs;
    }
    if (dead) {
      await removeLockDir(lockPath, io).catch(() => {});
      continue;
    }

    if (now() >= deadline) throw new DirLockTimeoutError(lockPath, holder, timeoutMs);
    await sleep(Math.min(pollMs, Math.max(0, deadline - now())));
  }
}
