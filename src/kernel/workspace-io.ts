/*
<MODULE_CONTRACT>
<purpose>
RFC-0267: the WorkspaceIO port — the single seam through which kernel commands
touch the filesystem and spawn processes. `KernelRuntimeContext.io` carries an
adapter chosen by the executor: the default fs-backed adapter, a recording
adapter (universal `--dry-run`: intercepts writes/deletes, records intents,
touches nothing), or a read-only adapter (used for `mutatesState: false`
commands; throws KERNEL-META-01 on any attempted mutation). Adoption is
ratcheted — ambient `node:fs` imports keep working in unmigrated modules;
`kernel.io.lint` (IO-01) only gates new/migrated modules.

RFC-0326: `createDefaultIO` now returns `{ io, intents }` — the io writes to
real disk AND records every mutation as a `WriteIntent` for execution-report
surfacing (`filesModified`). This unifies the dry-run and real-run paths: both
capture intents, just from different adapters.
</purpose>
<non-goals>
  <item>Do not abstract network access — filesystem and process execution only.</item>
  <item>Do not enforce IO at the module-import level — that is kernel.io.lint's static check.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>WorkspaceIO is the single filesystem seam — kernel commands never touch fs directly.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-0326: createDefaultIO returns { io, intents } — writes touch real disk AND record WriteIntent[] for filesModified reporting.</item>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
  <item>RFC-1159: step 1 — execOrThrow helper in workspace-io</item>
  <item>RFC-1306 review-r1: writeFileIfChanged — io-port idempotent write (read-compare-skip); filesModified reports only real byte changes.</item>
  <history>RFC-0267</history>
</CHANGE_SUMMARY>
*/

import {
  readFile as fsReadFile,
  mkdir as fsMkdir,
  rm as fsRm,
  readdir as fsReaddir,
  stat,
  rename as fsRename,
  appendFile as fsAppendFile,
  copyFile as fsCopyFile,
  mkdtemp as fsMkdtemp,
  realpath as fsRealpath,
} from "node:fs/promises";
import { glob as fsGlob } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir as osTmpdir } from "node:os";
import { dirname, resolve as pathResolve, sep } from "node:path";
import { writeFileAtomic } from "./fs-atomic.ts";

export interface ExecOptions {
  cwd?: string;
  timeoutMs?: number;
  /** Extra environment variables merged over `process.env` for the child. */
  env?: Record<string, string>;
}

export interface ExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

/**
 * A directory entry in a port-neutral shape — no `node:fs` `Dirent` leaks
 * through the port, so command modules never need to import `node:fs` just to
 * type a listing. `isFile`/`isDirectory` are plain booleans (not methods).
 */
export interface DirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
}

/** Port-neutral `stat` result — no `node:fs` `Stats` leaks through the port. */
export interface FileStat {
  isFile: boolean;
  isDirectory: boolean;
  mtimeMs: number;
  size: number;
}

export interface WorkspaceIO {
  readFile(path: string): Promise<string>;
  readFileBytes(path: string): Promise<Uint8Array>;
  exists(path: string): Promise<boolean>;
  glob(pattern: string, opts?: { cwd?: string }): Promise<string[]>;
  /** List a directory's immediate entries. Read-only; throws if the path is not a directory. */
  readdir(path: string): Promise<DirEntry[]>;
  /** File metadata in a port-neutral shape. Throws when the path does not exist. */
  stat(path: string): Promise<FileStat>;
  /** Resolve symlinks to the canonical absolute path. Read-only. */
  realpath(path: string): Promise<string>;
  /** Atomic by contract (rfc-0258). */
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  /** Append content to a file, creating it (and parent dirs) when absent. */
  appendFile(path: string, content: string | Uint8Array): Promise<void>;
  mkdir(path: string): Promise<void>;
  rm(path: string, opts?: { recursive?: boolean }): Promise<void>;
  rename(src: string, dst: string): Promise<void>;
  copyFile(src: string, dst: string): Promise<void>;
  /** Create a unique temporary directory under `prefix`; returns its path. */
  mkdtemp(prefix: string): Promise<string>;
  exec(command: string, args: string[], opts?: ExecOptions): Promise<ExecResult>;
  /**
   * RFC-1176: `true` only on the read-only adapter (`mutatesState: false`
   * commands). Best-effort bookkeeping writes must be skipped with
   * `if (!io.readonly)` instead of attempting a mutation that throws
   * KERNEL-META-01 — the throw stays as the enforcement floor for
   * undeclared mutations. Undefined on real and recording adapters.
   */
  readonly readonly?: boolean;
}

async function execImpl(command: string, args: string[], opts?: ExecOptions): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts?.cwd,
      env: opts?.env ? { ...process.env, ...opts.env } : undefined,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    const timer = opts?.timeoutMs
      ? setTimeout(() => {
          child.kill();
        }, opts.timeoutMs)
      : undefined;
    timer?.unref?.();
    child.on("close", (exitCode) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode, stdout, stderr });
    });
    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * RFC-0326: the default, real fs-backed adapter. `writeFile` is atomic
 * (rfc-0258). Now returns `{ io, intents }` matching `createRecordingIO`'s
 * shape — the io writes to real disk; intents captures every mutation for
 * `filesModified` reporting on execution reports.
 */
export function createDefaultIO(): { io: WorkspaceIO; intents: WriteIntent[] } {
  const intents: WriteIntent[] = [];
  const io: WorkspaceIO = {
    async readFile(path) {
      return fsReadFile(path, "utf8");
    },
    async readFileBytes(path) {
      return fsReadFile(path);
    },
    async exists(path) {
      try {
        await stat(path);
        return true;
      } catch {
        return false;
      }
    },
    async glob(pattern, opts) {
      const results: string[] = [];
      for await (const entry of fsGlob(pattern, { cwd: opts?.cwd })) {
        results.push(entry);
      }
      return results;
    },
    async readdir(path) {
      const entries = await fsReaddir(path, { withFileTypes: true });
      return entries.map((entry) => ({
        name: entry.name,
        isFile: entry.isFile(),
        isDirectory: entry.isDirectory(),
      }));
    },
    async writeFile(path, content) {
      await fsMkdir(dirname(path), { recursive: true });
      await writeFileAtomic(path, content);
      const bytes =
        typeof content === "string" ? Buffer.byteLength(content, "utf8") : content.byteLength;
      intents.push({ kind: "write", path, bytes });
    },
    async mkdir(path) {
      await fsMkdir(path, { recursive: true });
      intents.push({ kind: "mkdir", path });
    },
    async rm(path, opts) {
      await fsRm(path, { recursive: opts?.recursive ?? false, force: true });
      intents.push({ kind: "rm", path });
    },
    async stat(path) {
      const s = await stat(path);
      return { isFile: s.isFile(), isDirectory: s.isDirectory(), mtimeMs: s.mtimeMs, size: s.size };
    },
    async realpath(path) {
      return fsRealpath(path);
    },
    async appendFile(path, content) {
      await fsMkdir(dirname(path), { recursive: true });
      await fsAppendFile(path, content);
      const bytes =
        typeof content === "string" ? Buffer.byteLength(content, "utf8") : content.byteLength;
      intents.push({ kind: "write", path, bytes });
    },
    async rename(src, dst) {
      await fsMkdir(dirname(dst), { recursive: true });
      await fsRename(src, dst);
      intents.push({ kind: "write", path: dst });
    },
    async copyFile(src, dst) {
      await fsMkdir(dirname(dst), { recursive: true });
      await fsCopyFile(src, dst);
      intents.push({ kind: "write", path: dst });
    },
    async mkdtemp(prefix) {
      const dir = await fsMkdtemp(prefix);
      intents.push({ kind: "mkdir", path: dir });
      return dir;
    },
    exec: execImpl,
  };
  return { io, intents };
}

export interface WriteIntent {
  kind: "write" | "mkdir" | "rm";
  path: string;
  bytes?: number;
  /** RFC-1149 follow-up: full text content recorded under --dry-run so the executor can surface `renderedFiles` for generated.drift.validate (DRIFT-02). Absent for binary writes and path-only intents. */
  content?: string;
}

/**
 * Wraps a base adapter for universal `--dry-run`: reads pass through to the
 * base adapter (so a command can still make write decisions based on real
 * state), but writes/mkdir/rm are intercepted, recorded, and never touch disk.
 */
export function createRecordingIO(base: WorkspaceIO): { io: WorkspaceIO; intents: WriteIntent[] } {
  const intents: WriteIntent[] = [];
  // RFC-1149 follow-up: accumulate rendered text content per path so the last
  // write intent for a path carries the full file — powers renderedFiles.
  const contents = new Map<string, string>();
  const io: WorkspaceIO = {
    readFile: base.readFile.bind(base),
    readFileBytes: base.readFileBytes.bind(base),
    exists: base.exists.bind(base),
    glob: base.glob.bind(base),
    readdir: base.readdir.bind(base),
    stat: base.stat.bind(base),
    realpath: base.realpath.bind(base),
    async writeFile(path, content) {
      const bytes =
        typeof content === "string" ? Buffer.byteLength(content, "utf8") : content.byteLength;
      const text = typeof content === "string" ? content : undefined;
      if (text === undefined) contents.delete(path);
      else contents.set(path, text);
      intents.push({ kind: "write", path, bytes, content: text });
    },
    async appendFile(path, content) {
      const bytes =
        typeof content === "string" ? Buffer.byteLength(content, "utf8") : content.byteLength;
      // Append accumulates onto content recorded earlier this run; appending
      // to a path never written stays unverifiable — same as before.
      const prior = contents.get(path);
      const combined =
        prior !== undefined && typeof content === "string" ? prior + content : undefined;
      if (combined === undefined) contents.delete(path);
      else contents.set(path, combined);
      intents.push({ kind: "write", path, bytes, content: combined });
    },
    async mkdir(path) {
      intents.push({ kind: "mkdir", path });
    },
    async rm(path) {
      contents.delete(path);
      intents.push({ kind: "rm", path });
    },
    async rename(_src, dst) {
      contents.delete(dst);
      intents.push({ kind: "write", path: dst });
    },
    async copyFile(_src, dst) {
      contents.delete(dst);
      intents.push({ kind: "write", path: dst });
    },
    async mkdtemp(prefix) {
      const dir = `${prefix}dry-run`;
      intents.push({ kind: "mkdir", path: dir });
      return dir;
    },
    async exec(command, args, opts) {
      // Read-only git subcommands pass through to the base adapter — they
      // cannot mutate repository state, so a dry-run command may resolve real
      // state through them (staged-set reads, ancestry checks). Anything else
      // fails closed: a mutating exec must never run under --dry-run just
      // because it looks harmless.
      if (command === "git" && args.length > 0 && RECORDING_IO_READONLY_GIT.has(args[0]!)) {
        return base.exec(command, args, opts);
      }
      const sub = args[0] ? ` ${args[0]}` : "";
      throw new Error(
        `createRecordingIO: exec() for \`${command}${sub}\` is not supported under --dry-run (not on the read-only allowlist).`,
      );
    },
  };
  return { io, intents };
}

/**
 * Git subcommands the recording IO executes for real under --dry-run —
 * strictly read-only state resolution (index/worktree reads, ancestry
 * checks). `status` may refresh the index mtime — benign, no content change.
 * Mutating subcommands (add/commit/reset/checkout/…) stay refused.
 */
const RECORDING_IO_READONLY_GIT = new Set([
  "ls-files",
  "diff",
  "status",
  "log",
  "rev-parse",
  "show",
  "merge-base",
  "branch",
  "cat-file",
  "describe",
]);

/**
 * RFC-1159: canonical exit-code check on `io.exec`. `execImpl` resolves
 * non-zero exits as data (the `ExecResult` contract) — commands must not let
 * a failed side effect masquerade as success (DNA-106). Use this for
 * failure-semantics calls (git commit/add/reset, mv, exiftool, …); pass
 * `allowExitCodes` for signal-semantics calls where a non-zero exit is the
 * answer, not a failure (`git diff --quiet`, `git rev-parse --verify`).
 */
export async function execOrThrow(
  io: WorkspaceIO,
  command: string,
  args: string[],
  opts?: ExecOptions & { allowExitCodes?: number[] },
): Promise<ExecResult> {
  const { allowExitCodes, ...execOpts } = opts ?? {};
  const result = await io.exec(command, args, execOpts);
  const code = result.exitCode;
  if (code !== 0 && !(code !== null && allowExitCodes?.includes(code))) {
    const sub = args[0] ? ` ${args[0]}` : "";
    const detail = result.stderr.trim() || result.stdout.trim() || "(no output)";
    throw new Error(`${command}${sub} failed (exit ${code ?? "null"}): ${detail}`);
  }
  return result;
}

/**
 * RFC-1306: idempotent write through the io port — reads the current content
 * and calls `io.writeFile` only when bytes differ. A no-op write records no
 * intent, so `filesModified` reports "changed" honestly (zero-diff regens
 * report zero files). io.writeFile already mkdirs + writes atomically.
 * Returns true when the file was (re)written.
 */
export async function writeFileIfChanged(
  io: WorkspaceIO,
  path: string,
  content: string | Uint8Array,
): Promise<boolean> {
  try {
    if (typeof content === "string") {
      if ((await io.readFile(path)) === content) return false;
    } else {
      const existing = await io.readFileBytes(path);
      if (existing.length === content.length && Buffer.from(existing).equals(content)) return false;
    }
  } catch {
    // Missing/unreadable target — fall through to write.
  }
  await io.writeFile(path, content);
  return true;
}

export class KernelMetaError extends Error {
  constructor(
    readonly commandName: string,
    readonly attemptedPath: string,
  ) {
    super(
      `KERNEL-META-01: command "${commandName}" declares mutatesState: false but attempted to write "${attemptedPath}". ` +
        `Fix the command, or if the write is legitimate, set mutatesState: true and declare the path in writes (RFC-0266).`,
    );
    this.name = "KernelMetaError";
  }
}

export interface ReadOnlyIOOptions {
  /**
   * RFC-1176: pass `command.execOnReadOnly === true` — the command declared
   * subprocess use, so `exec` is bound through instead of throwing. All
   * filesystem mutations still throw KERNEL-META-01.
   */
  allowExec?: boolean;
  /**
   * RFC-1176: the workspace root — the tmpdir carve-out below must NOT apply
   * to paths inside it (a workshop itself may live under $TMPDIR, e.g. test
   * fixtures and CI smoke workspaces). When absent, any tmpdir path passes.
   */
  workspaceRoot?: string;
  /**
   * RFC-1303: workspace-relative directory prefixes the command declared via
   * `cacheWrites` — writes resolving under them delegate to the wrapped
   * adapter instead of throwing. Requires `workspaceRoot`; without it the
   * prefixes cannot resolve and every write still throws KERNEL-META-01.
   * Entries are cache-class paths only — CACHE-WRITE-01 rejects git-tracked
   * prefixes at declaration-validation time.
   */
  cacheWrites?: string[];
}

/**
 * Wraps a base adapter so every mutation throws KERNEL-META-01 naming the
 * command and the attempted path. Used for every `mutatesState: false`
 * command (proves the metadata trustworthy) and by the test harness.
 *
 * RFC-1176 carve-outs: mutations targeting paths under `os.tmpdir()` pass
 * through — scratch space is not workspace state — unless the path is
 * inside `opts.workspaceRoot` (workshops can live under $TMPDIR). `exec`
 * passes through when `opts.allowExec` (the command declared
 * `execOnReadOnly`). `io.readonly` reports `true` so commands can skip
 * best-effort writes instead of relying on the throw.
 */
export function createReadOnlyIO(
  base: WorkspaceIO,
  commandName: string,
  opts?: ReadOnlyIOOptions,
): WorkspaceIO {
  const tmpRoots = [osTmpdir(), pathResolve(osTmpdir())].map((r) =>
    r.endsWith(sep) ? r : r + sep,
  );
  const workspaceRoot = opts?.workspaceRoot ? pathResolve(opts.workspaceRoot) : undefined;
  const isTmpPath = (p: string) => {
    const abs = pathResolve(p);
    if (workspaceRoot && (abs === workspaceRoot || abs.startsWith(workspaceRoot + sep)))
      return false;
    return tmpRoots.some((root) => abs.startsWith(root));
  };
  // RFC-1303: declared cache-write prefixes resolve under the workspace root;
  // a write landing inside one delegates to the real adapter.
  const cachePrefixes = (opts?.cacheWrites ?? [])
    .map((prefix) => (workspaceRoot ? pathResolve(workspaceRoot, prefix) : undefined))
    .filter((p): p is string => p !== undefined)
    .map((p) => (p.endsWith(sep) ? p : p + sep));
  const isCacheWritePath = (p: string) =>
    cachePrefixes.length > 0 &&
    cachePrefixes.some((root) => {
      const abs = pathResolve(p);
      // Equal match allows mkdir/writeFile on the prefix dir itself.
      return abs === root.slice(0, -sep.length) || abs.startsWith(root);
    });
  const mayWrite = (p: string) => isTmpPath(p) || isCacheWritePath(p);
  return {
    readFile: base.readFile.bind(base),
    readFileBytes: base.readFileBytes.bind(base),
    exists: base.exists.bind(base),
    glob: base.glob.bind(base),
    readdir: base.readdir.bind(base),
    stat: base.stat.bind(base),
    realpath: base.realpath.bind(base),
    readonly: true,
    async writeFile(path, content) {
      if (mayWrite(path)) return base.writeFile(path, content);
      throw new KernelMetaError(commandName, path);
    },
    async appendFile(path, content) {
      if (mayWrite(path)) return base.appendFile(path, content);
      throw new KernelMetaError(commandName, path);
    },
    async mkdir(path) {
      if (mayWrite(path)) return base.mkdir(path);
      throw new KernelMetaError(commandName, path);
    },
    async rm(path, rmOpts) {
      if (mayWrite(path)) return base.rm(path, rmOpts);
      throw new KernelMetaError(commandName, path);
    },
    async rename(src, dst) {
      if (mayWrite(dst)) return base.rename(src, dst);
      throw new KernelMetaError(commandName, dst);
    },
    async copyFile(src, dst) {
      if (mayWrite(dst)) return base.copyFile(src, dst);
      throw new KernelMetaError(commandName, dst);
    },
    async mkdtemp(prefix) {
      if (mayWrite(prefix)) return base.mkdtemp(prefix);
      throw new KernelMetaError(commandName, prefix);
    },
    exec: opts?.allowExec
      ? base.exec.bind(base)
      : async (command, args) => {
          throw new KernelMetaError(commandName, `${command} ${args.join(" ")}`);
        },
  };
}
