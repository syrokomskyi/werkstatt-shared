import { test, expect } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDefaultIO,
  createRecordingIO,
  createReadOnlyIO,
  execOrThrow,
  KernelMetaError,
} from "../workspace-io.ts";
import type { ExecResult, WorkspaceIO } from "../workspace-io.ts";

/*
<MODULE_CONTRACT>
<purpose>
Unit tests for workspace io covering its documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the workspace suite's contract for test-file scaffold coverage.</item>
  <item>RFC-1495: read-only commands resolve workshop paths; worktree gate declares its subprocesses

Every workshop path now resolves through git rev-parse and git worktree list
(RFC-1495), but the read-only adapter that mutatesState:false commands get
refuses every exec. About a hundred read-only commands (workpiece.read,
workpiece.config.presence.check, ...) crashed with KERNEL-META-01, and so did
werkstatt.worktree.gate, which would refuse every flow.integrate. The adapter
now passes exactly git -C <dir> rev-parse and git -C <dir> worktree list (no
caller env); the gate declares execOnReadOnly and its env inputs. The
visual-regression gate test awaits the now-async baselineManifestPath.</item>
  <item>RFC-1496: step 1 — read-only git allowlist gains ls-files

Rename isWorktreeTopologyQuery to isReadOnlyGitQuery and admit git -C <dir> ls-files alongside rev-parse and worktree list; a caller-supplied env stays refused. The platform file set (step 2) resolves through ls-files, so read-only commands computing the platform hash would otherwise crash KERNEL-META-01 (AC-8).</item>
</CHANGE_SUMMARY>
*/

test("createDefaultIO: writeFile creates the file with exact content, no leftover temp file", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-io-default-"));
  try {
    const { io } = createDefaultIO();
    const target = join(root, "nested", "file.txt");
    await io.writeFile(target, "hello world");

    const content = await readFile(target, "utf8");
    expect(content).toBe("hello world");

    const entries = await import("node:fs/promises").then((fs) => fs.readdir(join(root, "nested")));
    expect(entries).toEqual(["file.txt"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createDefaultIO: exists/readFile/mkdir/rm round-trip", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-io-default2-"));
  try {
    const { io } = createDefaultIO();
    expect(await io.exists(join(root, "missing.txt"))).toBe(false);

    await io.mkdir(join(root, "dir"));
    expect(await io.exists(join(root, "dir"))).toBe(true);

    await io.writeFile(join(root, "dir", "a.txt"), "a");
    expect(await io.readFile(join(root, "dir", "a.txt"))).toBe("a");

    await io.rm(join(root, "dir"), { recursive: true });
    expect(await io.exists(join(root, "dir"))).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createDefaultIO: readdir returns port-neutral DirEntry[] with isFile/isDirectory booleans", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-io-readdir-"));
  try {
    const { io } = createDefaultIO();
    await io.writeFile(join(root, "a.md"), "content");
    await io.mkdir(join(root, "subdir"));

    const entries = (await io.readdir(root)).sort((x, y) => x.name.localeCompare(y.name));
    expect(entries).toEqual([
      { name: "a.md", isFile: true, isDirectory: false },
      { name: "subdir", isFile: false, isDirectory: true },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createReadOnlyIO and createRecordingIO: readdir passes through (a read, not a mutation)", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-io-readdir-passthrough-"));
  try {
    const { io: base } = createDefaultIO();
    await base.writeFile(join(root, "x.txt"), "x");

    const readOnly = createReadOnlyIO(base, "fixture.readonly.command");
    expect((await readOnly.readdir(root))[0]?.name).toBe("x.txt");

    const { io: recording } = createRecordingIO(base);
    expect((await recording.readdir(root))[0]?.name).toBe("x.txt");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createRecordingIO: captures write/mkdir/rm intents and never touches disk", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-io-recording-"));
  try {
    const { io: base } = createDefaultIO();
    const { io, intents } = createRecordingIO(base);

    const target = join(root, "would-write.txt");
    await io.writeFile(target, "some content");
    await io.mkdir(join(root, "would-mkdir"));
    await io.rm(join(root, "would-rm"));

    expect(intents.length).toBe(3);
    expect(intents.map((i) => i.kind)).toEqual(["write", "mkdir", "rm"]);
    expect(intents[0]?.path).toBe(target);
    expect(intents[0]?.bytes).toBe(Buffer.byteLength("some content", "utf8"));

    // Nothing was actually written.
    await expect(() => stat(target)).rejects.toThrow();
    const rootEntries = await import("node:fs/promises").then((fs) => fs.readdir(root));
    expect(rootEntries).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createRecordingIO: reads pass through to the base adapter", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-io-recording-reads-"));
  try {
    const { io: base } = createDefaultIO();
    await base.writeFile(join(root, "existing.txt"), "real content");

    const { io } = createRecordingIO(base);
    expect(await io.exists(join(root, "existing.txt"))).toBe(true);
    expect(await io.readFile(join(root, "existing.txt"))).toBe("real content");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createReadOnlyIO: throws KERNEL-META-01 naming the command and path on writeFile", async () => {
  const io = createReadOnlyIO(createDefaultIO().io, "fixture.readonly.command");
  const target = join(process.cwd(), "readonly-guard-should-not-write.txt");
  try {
    await io.writeFile(target, "x");
    expect.fail("should have thrown");
  } catch (error) {
    expect(error).toBeInstanceOf(KernelMetaError);
    expect((error as Error).message).toMatch(/KERNEL-META-01/);
    expect((error as Error).message).toMatch(/fixture\.readonly\.command/);
    expect((error as Error).message).toMatch(/readonly-guard-should-not-write\.txt/);
  }
});

test("createReadOnlyIO: throws on mkdir, rm, and exec too", async () => {
  const io = createReadOnlyIO(createDefaultIO().io, "fixture.readonly.command");
  const target = join(process.cwd(), "readonly-guard-nope");
  await expect(() => io.mkdir(target)).rejects.toThrow(KernelMetaError);
  await expect(() => io.rm(target)).rejects.toThrow(KernelMetaError);
  await expect(() => io.exec("rm", ["-rf", target])).rejects.toThrow(KernelMetaError);
});

test("createReadOnlyIO: reports readonly and passes tmpdir-scoped mutations through", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-io-readonly-tmp-"));
  try {
    const io = createReadOnlyIO(createDefaultIO().io, "fixture.readonly.command");
    expect(io.readonly).toBe(true);
    // RFC-1176: scratch space under os.tmpdir() is not workspace state —
    // mutations there pass through instead of throwing.
    const target = join(root, "scratch.txt");
    await io.writeFile(target, "scratch");
    expect(await io.readFile(target)).toBe("scratch");
    const tmpDir = await io.mkdtemp(join(tmpdir(), "workspace-io-mkdtemp-"));
    await io.rm(tmpDir, { recursive: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createReadOnlyIO: allowExec binds subprocess calls through to the base adapter", async () => {
  const io = createReadOnlyIO(createDefaultIO().io, "fixture.readonly.command", {
    allowExec: true,
  });
  const result = await io.exec("echo", ["hello"]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout.trim()).toBe("hello");
  // Filesystem mutations still throw even with allowExec.
  await expect(() =>
    io.writeFile(join(process.cwd(), "readonly-guard-no.txt"), "x"),
  ).rejects.toThrow(KernelMetaError);
});

// RFC-1495/RFC-1496: workshop paths resolve through git topology queries and
// the platform file set through ls-files, so the read-only adapter passes
// `git -C <dir> rev-parse`, `git -C <dir> worktree list` and
// `git -C <dir> ls-files` through; every other git call still throws.
test("createReadOnlyIO: git rev-parse, worktree list and ls-files pass through, other git calls throw", async () => {
  const io = createReadOnlyIO(createDefaultIO().io, "fixture.readonly.command");
  const top = await io.exec("git", ["-C", process.cwd(), "rev-parse", "--show-toplevel"]);
  expect(top.exitCode).toBe(0);
  const list = await io.exec("git", ["-C", process.cwd(), "worktree", "list", "--porcelain"]);
  expect(list.exitCode).toBe(0);
  expect(list.stdout).toContain("worktree ");
  const ls = await io.exec("git", ["-C", process.cwd(), "ls-files", "--", "packages"]);
  expect(ls.exitCode).toBe(0);
  await expect(() =>
    io.exec("git", ["-C", process.cwd(), "add", "packages/x.ts"]),
  ).rejects.toThrow(KernelMetaError);
  await expect(() =>
    io.exec("git", ["-C", process.cwd(), "worktree", "add", join(tmpdir(), "nope")]),
  ).rejects.toThrow(KernelMetaError);
  await expect(() => io.exec("git", ["-C", process.cwd(), "branch", "-D", "nope"])).rejects.toThrow(
    KernelMetaError,
  );
  await expect(() => io.exec("git", ["rev-parse", "HEAD"])).rejects.toThrow(KernelMetaError);
  await expect(() =>
    io.exec("git", ["-C", process.cwd(), "rev-parse", "HEAD"], {
      env: { GIT_DIR: "/nonexistent" },
    }),
  ).rejects.toThrow(KernelMetaError);
});

// RFC-1303: cacheWrites carve-out — declared prefixes delegate to the base
// adapter even on a read-only invocation; everything else still throws.
test("createReadOnlyIO: cacheWrites prefixes delegate writes to the base adapter (RFC-1303)", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-io-cachewrites-"));
  try {
    const { io: base } = createDefaultIO();
    const io = createReadOnlyIO(base, "fixture.cache.command", {
      workspaceRoot: root,
      cacheWrites: [".cache/"],
    });
    await io.mkdir(join(root, ".cache"));
    await io.writeFile(join(root, ".cache", "lt.json"), "{}");
    expect(await io.readFile(join(root, ".cache", "lt.json"))).toBe("{}");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createReadOnlyIO: writes outside declared cacheWrites prefixes still throw KERNEL-META-01", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-io-cachewrites-deny-"));
  try {
    const { io: base } = createDefaultIO();
    const io = createReadOnlyIO(base, "fixture.cache.command", {
      workspaceRoot: root,
      cacheWrites: [".cache/"],
    });
    await expect(() => io.writeFile(join(root, "src", "x.txt"), "x")).rejects.toThrow(
      KernelMetaError,
    );
    await expect(() => io.mkdir(join(root, "src"))).rejects.toThrow(KernelMetaError);
    await expect(() => io.rm(join(root, "src"))).rejects.toThrow(KernelMetaError);
    // A sibling prefix that merely shares a leading segment does not match.
    await expect(() => io.writeFile(join(root, ".cache-other", "x.txt"), "x")).rejects.toThrow(
      KernelMetaError,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createReadOnlyIO: absolute cacheWrites prefixes pass through unchanged (app-scope expansion)", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-io-cachewrites-abs-"));
  try {
    const { io: base } = createDefaultIO();
    // Simulates the executor expanding "<app>/.cache/" to an absolute site dir.
    // workspaceRoot covers the whole fixture tree so tmpdir passthrough does
    // not mask the prefix check.
    const io = createReadOnlyIO(base, "fixture.cache.command", {
      workspaceRoot: root,
      cacheWrites: [join(root, "site", ".cache") + "/"],
    });
    await io.writeFile(join(root, "site", ".cache", "lt.json"), "{}");
    expect(await io.readFile(join(root, "site", ".cache", "lt.json"))).toBe("{}");
    await expect(() => io.writeFile(join(root, "site", "src", "x.ts"), "x")).rejects.toThrow(
      KernelMetaError,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createReadOnlyIO: reads still work", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-io-readonly-reads-"));
  try {
    const { io: base } = createDefaultIO();
    await base.writeFile(join(root, "readable.txt"), "readable content");

    const io = createReadOnlyIO(base, "fixture.readonly.command");
    expect(await io.exists(join(root, "readable.txt"))).toBe(true);
    expect(await io.readFile(join(root, "readable.txt"))).toBe("readable content");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// RFC-0326: createDefaultIO now returns { io, intents } — the intents array
// captures every mutation (write/mkdir/rm) for filesModified reporting.
test("createDefaultIO: captures write/mkdir/rm intents while writing to real disk (RFC-0326)", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-io-default-intents-"));
  try {
    const { io, intents } = createDefaultIO();

    await io.writeFile(join(root, "file.txt"), "content");
    await io.mkdir(join(root, "subdir"));
    await io.rm(join(root, "subdir"), { recursive: true });

    expect(intents.length).toBe(3);
    expect(intents.map((i) => i.kind)).toEqual(["write", "mkdir", "rm"]);
    expect(intents[0]?.bytes).toBe(Buffer.byteLength("content", "utf8"));

    // File was actually written to disk (this is the real adapter, not recording).
    expect(await io.readFile(join(root, "file.txt"))).toBe("content");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// RFC-1159: execOrThrow — canonical exit-code check on io.exec (DNA-106).
function stubIo(result: ExecResult): WorkspaceIO {
  return { exec: async () => result } as unknown as WorkspaceIO;
}

test("execOrThrow: returns the ExecResult on exit 0", async () => {
  const expected: ExecResult = { exitCode: 0, stdout: "ok", stderr: "" };
  const result = await execOrThrow(stubIo(expected), "git", ["status"]);
  expect(result).toBe(expected);
});

test("execOrThrow: throws carrying the exit code and stderr on non-zero", async () => {
  const io = stubIo({ exitCode: 128, stdout: "", stderr: "fatal: not a git repo" });
  await expect(execOrThrow(io, "git", ["commit", "-m", "x"])).rejects.toThrow(
    /git commit failed \(exit 128\): fatal: not a git repo/,
  );
});

test("execOrThrow: allowExitCodes passes through a listed non-zero exit", async () => {
  const expected: ExecResult = { exitCode: 1, stdout: "", stderr: "" };
  const result = await execOrThrow(stubIo(expected), "git", ["diff", "--quiet"], {
    allowExitCodes: [1],
  });
  expect(result).toBe(expected);
});

test("execOrThrow: a non-zero exit not in allowExitCodes still throws", async () => {
  const io = stubIo({ exitCode: 2, stdout: "", stderr: "boom" });
  await expect(
    execOrThrow(io, "git", ["diff", "--quiet"], { allowExitCodes: [1] }),
  ).rejects.toThrow(/git diff failed \(exit 2\)/);
});

test("execOrThrow: null exitCode (signal kill) throws", async () => {
  const io = stubIo({ exitCode: null, stdout: "", stderr: "killed" });
  await expect(execOrThrow(io, "git", ["status"])).rejects.toThrow(/exit null/);
});

test("execOrThrow: forwards ExecOptions minus allowExitCodes to io.exec", async () => {
  let seenOpts: unknown;
  const io = {
    exec: async (_c: string, _a: string[], opts?: unknown) => {
      seenOpts = opts;
      return { exitCode: 0, stdout: "", stderr: "" };
    },
  } as unknown as WorkspaceIO;
  await execOrThrow(io, "git", ["status"], { cwd: "/w", timeoutMs: 5, allowExitCodes: [1] });
  expect(seenOpts).toEqual({ cwd: "/w", timeoutMs: 5 });
});
