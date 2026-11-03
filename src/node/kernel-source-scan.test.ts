/*
<MODULE_CONTRACT>
<purpose>
  kernel-source-scan determinism and coverage tests (RFC-1497): fixture source
  trees under os.tmpdir() scanned with createSourceScanner(<tmp root>) — never
  the live workspace. AC-1/AC-2 model the read-only git allowlist against a
  fixture git.ts mirroring packages/forge/os/flow/git.ts shape; AC-3/AC-8 judge
  child commands by declaration; AC-4 proves per-command hit sets identical
  under forward/reverse/single scans; AC-5 reports truncation with limit.
</purpose>
<non-goals>
  <item>Not the ratchet — registry-integrity.test.ts owns the live lists (AC-6, AC-7).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1497: step 2 — deterministic slicing and truncation reporting tests</item>
  <item>RFC-1497: step 2 — deterministic slicing and truncation reporting

visited is keyed by identifier AND remaining depth: an ident first reached at low remaining depth re-resolves when a later path reaches it with more budget, so the slice set no longer depends on which path the DFS took first. ScanStats gains limit (slices|depth|slice-text|dynamic-child) recording the first limit hit; stats.limit is reset per call. Root cause of the observed order flip confirmed and recorded for the review: sequential expects (unresolved -> unguarded -> guarded) masked the already-computed guarded hit set — adding cacheWrites to the gate exempted its own unguarded hit, let the unguarded assert pass, and the guarded assert then surfaced 108 pre-existing hits at git.ts:51. Fixture tests cover AC-4 (identical hit sets forward/reverse/single, deep coverage survives shallow-first reach) and AC-5 (deep re-export chain reports truncated+depth).</item>
  <item>RFC-1497: steps 3-4 — git allowlist model and child-command resolution

READ_ONLY_GIT_QUERIES in workspace-io.ts is the single allowlist both the runtime adapter and the static scan share (DNA-91). In the scan, a call that resolves to forge git() body is exempt only when its argv array literal's leading strings cover an allowlist entry; a scratch re-resolve per callsite keeps already-visited callees independently classified, and one non-allowlisted route flips the git() body slice back to a hit (allowlistedGitEntry on the slice). Child commands are judged by declaration, never by descent: executeKernelCommand/executeRegisteredCommand sit in CALLEE_SKIP, and when the caller passes a childCalls out-param the scanner resolves the name (literal, const string, or for-of over a const string array) through an injected resolveCommandDeclaration; an unresolvable name truncates the scan with limit dynamic-child. The child model is opt-in so env scans stay unmarked. Fixtures cover AC-1 (rev-parse no hit), AC-2 (branch -D hit), AC-3 (no executor descent), AC-8 (mutating child recorded), plus mixed-route and dynamic-name cases.</item>
  <item>RFC-1501: one argv-shaped read-only git allowlist for the recording and read-only adapters (RFC-1501)

READ_ONLY_GIT_QUERIES / isReadOnlyGitQuery replace the recording adapter's
first-argument allowlist; the read-only adapter and the static scan use the same
table. The kernel forwards --dry-run into commands that declare a dry-run flag,
and flow.push / flow.hold dry-runs no longer fetch. The switch-over runbook goes
back to werkstatt run flow.install --dry-run.</item>
  <item>RFC-1501: close the read-only git allowlist against argv-introduced programs and abbreviated flags (RFC-1501)

Independent review: ls-remote --upload-pack ran a program, rev-list --output
truncated files, and symbolic-ref -qd / --dele slipped past exact-match forbids.
Forbidden flags now match exactly, with =value, abbreviated or inside a short
cluster; ls-remote, rev-list and log gained forbid lists; show-ref lost its
wrong one. The static scan checks every literal against the forbid list and
leaves dynamic elements to the runtime predicate. RFC text amended to match
(flow.hold no-fetch, trust boundary, table).</item>
</CHANGE_SUMMARY>
*/

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";

import { createSourceScanner, type HandlerSlice } from "./kernel-source-scan.ts";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Write a fixture source file; returns its absolute path. */
function put(root: string, rel: string, content: string): string {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  return abs;
}

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "kscan-"));
  dirs.push(root);
  return root;
}

/**
 * io.exec call locations inside the returned slices — the hit set the
 * ratchet's mutationHits derives for kind "exec" (fixture-local mirror).
 */
function execHitLocs(root: string, slices: HandlerSlice[]): string[] {
  const locs: string[] = [];
  for (const s of slices) {
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const recv = n.expression.expression;
        const ident = ts.isIdentifier(recv) ? recv.text : ts.isPropertyAccessExpression(recv) ? recv.name.text : "";
        if (ident === "io" && n.expression.name.text === "exec") {
          locs.push(`${s.file.replace(`${root}/`, "")}:${s.node.getStart()}`);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(s.node);
  }
  return [...new Set(locs)].sort();
}

// ---------------------------------------------------------------------------
// AC-4 — order independence
// ---------------------------------------------------------------------------

describe("AC-4: per-command hit sets are scan-order independent", () => {
  it("forward, reverse and single scans agree", () => {
    const root = makeRoot();
    // Shared helper graph: helper → deep → io.exec. Both commands reach the
    // same helper through different call arrangements.
    put(
      root,
      "src/helpers/deep.ts",
      `export async function deep(io: any): Promise<void> { await io.exec("git", ["status"]); }\n`,
    );
    put(
      root,
      "src/helpers/helper.ts",
      `import { deep } from "./deep.ts";
export async function helper(io: any): Promise<void> { await deep(io); }\n`,
    );
    const cmdA = put(
      root,
      "src/commands/a.ts",
      `import { helper } from "../helpers/helper.ts";
export const cmdA = {
  name: "a.read",
  mutatesState: false,
  execute: async (input: any, ctx: any) => { await helper(ctx.io); },
};\n`,
    );
    const cmdB = put(
      root,
      "src/commands/b.ts",
      `import { helper } from "../helpers/helper.ts";
export const cmdB = {
  name: "b.read",
  mutatesState: false,
  execute: async (input: any, ctx: any) => { await helper(ctx.io); await helper(ctx.io); },
};\n`,
    );

    const scanner = createSourceScanner(root);
    const scanOne = (file: string, name: string) =>
      execHitLocs(root, scanner.handlerSlices(file, name));

    const forward = { a: scanOne(cmdA, "a.read"), b: scanOne(cmdB, "b.read") };
    const scanner2 = createSourceScanner(root);
    const scanOne2 = (file: string, name: string) =>
      execHitLocs(root, scanner2.handlerSlices(file, name));
    const reverse = { b: scanOne2(cmdB, "b.read"), a: scanOne2(cmdA, "a.read") };
    const scanner3 = createSourceScanner(root);
    const scanOne3 = (file: string, name: string) =>
      execHitLocs(root, scanner3.handlerSlices(file, name));
    const single = { a: scanOne3(cmdA, "a.read"), b: scanOne3(cmdB, "b.read") };

    expect(forward.a).toEqual(single.a);
    expect(forward.b).toEqual(single.b);
    expect(reverse.a).toEqual(forward.a);
    expect(reverse.b).toEqual(forward.b);
    // The deep io.exec IS reached — the sets are not just vacuously equal.
    expect(forward.a.length).toBeGreaterThan(0);
  });

  it("a helper reached shallow first still yields its deep coverage", () => {
    const root = makeRoot();
    // `shared` is bound to a 6-deep re-export chain AND called directly: the
    // direct call must still reach mut() — the depth-visited poisoning bug
    // dropped the direct resolution once the barrel chain had marked `shared`.
    const chain = ["b0", "b1", "b2", "b3", "b4", "b5", "b6"];
    chain.forEach((name, i) => {
      const next = chain[i + 1];
      put(
        root,
        `src/barrel/${name}.ts`,
        next ? `export * from "./${next}.ts";\n` : `export function shared(io: any) { return io.exec("git", ["status"]); }\n`,
      );
    });
    put(
      root,
      "src/commands/c.ts",
      `import { shared } from "../barrel/b0.ts";
export const cmdC = {
  name: "c.read",
  mutatesState: false,
  execute: async (input: any, ctx: any) => { await shared(ctx.io); },
};\n`,
    );
    const file = join(root, "src/commands/c.ts");
    const scanner = createSourceScanner(root);
    const stats = { unresolved: false, truncated: false };
    const slices = scanner.handlerSlices(file, "c.read", stats);
    // The barrel chain itself exceeds MAX_RESOLVE_DEPTH — truncated is fine;
    // the returned slices are then a lower bound and the stats SAY so.
    expect(execHitLocs(root, slices)).toEqual([]);
    expect(stats.truncated).toBe(true);
    expect(stats.limit).toBe("depth");
  });
});

// ---------------------------------------------------------------------------
// AC-5 — truncation reporting
// ---------------------------------------------------------------------------

describe("AC-5: a call chain beyond MAX_RESOLVE_DEPTH reports truncated+depth", () => {
  it("deep re-export chain marks stats.truncated with limit depth", () => {
    const root = makeRoot();
    const chain = ["d0", "d1", "d2", "d3", "d4", "d5", "d6", "d7"];
    chain.forEach((name, i) => {
      const next = chain[i + 1];
      put(
        root,
        `src/deep/${name}.ts`,
        next
          ? `export * from "./${next}.ts";\n`
          : `export function leaf() { return 1; }\n`,
      );
    });
    const file = put(
      root,
      "src/commands/e.ts",
      `import { leaf } from "../deep/d0.ts";
export const cmdE = {
  name: "e.read",
  mutatesState: false,
  execute: async () => { leaf(); },
};\n`,
    );
    const scanner = createSourceScanner(root);
    const stats = { unresolved: false, truncated: false };
    scanner.handlerSlices(file, "e.read", stats);
    expect(stats.truncated).toBe(true);
    expect(stats.limit).toBe("depth");
  });
});

// ---------------------------------------------------------------------------
// AC-1/AC-2 — read-only git allowlist modelled on a fixture forge git.ts
// ---------------------------------------------------------------------------

/**
 * Fixture forge git() helper mirroring packages/forge/os/flow/git.ts shape —
 * the scanner recognises the body by its path suffix and enclosing name, so
 * the fixture keeps the same layout under its own root.
 */
const FIXTURE_GIT_TS = `export async function git(root: string, io: any, args: string[]): Promise<string> {
  const res = await io.exec("git", ["-C", root, ...args]);
  return res.stdout;
}
`;

/** io.exec hit locations — a slice flagged allowlistedGitEntry contributes none. */
function ratchetExecHits(root: string, slices: HandlerSlice[]): string[] {
  const locs: string[] = [];
  for (const s of slices) {
    if (s.allowlistedGitEntry) continue;
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const recv = n.expression.expression;
        if (ts.isIdentifier(recv) && recv.text === "io" && n.expression.name.text === "exec") {
          locs.push(`${s.file.replace(`${root}/`, "")}:${n.getStart()}`);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(s.node);
  }
  return [...new Set(locs)].sort();
}

describe("AC-1/AC-2: the scan models the read-only git allowlist", () => {
  it("AC-1: git(root, io, ['rev-parse', '--show-toplevel']) reports no exec hit", () => {
    const root = makeRoot();
    put(root, "forge/os/flow/git.ts", FIXTURE_GIT_TS);
    const file = put(
      root,
      "src/commands/g1.ts",
      `import { git } from "../../forge/os/flow/git.ts";
export const cmdG = {
  name: "g.read",
  mutatesState: false,
  execute: async (input: any, ctx: any) => {
    await git(ctx.workspaceRoot, ctx.io, ["rev-parse", "--show-toplevel"]);
  },
};\n`,
    );
    const scanner = createSourceScanner(root);
    const slices = scanner.handlerSlices(file, "g.read");
    expect(ratchetExecHits(root, slices)).toEqual([]);
    // The git() body slice IS present — exempted callsite-by-callsite.
    expect(slices.some((s) => s.file.endsWith("git.ts") && s.allowlistedGitEntry === true)).toBe(
      true,
    );
  });

  it("AC-2: git(root, io, ['branch', '-D', name]) still reports an exec hit", () => {
    const root = makeRoot();
    put(root, "forge/os/flow/git.ts", FIXTURE_GIT_TS);
    const file = put(
      root,
      "src/commands/g2.ts",
      `import { git } from "../../forge/os/flow/git.ts";
export const cmdG = {
  name: "g.write",
  mutatesState: false,
  execute: async (input: any, ctx: any) => {
    const name = "auto/x";
    await git(ctx.workspaceRoot, ctx.io, ["branch", "-D", name]);
  },
};\n`,
    );
    const scanner = createSourceScanner(root);
    const slices = scanner.handlerSlices(file, "g.write");
    expect(ratchetExecHits(root, slices)).toEqual([expect.stringContaining("git.ts")]);
    expect(slices.some((s) => s.file.endsWith("git.ts") && s.allowlistedGitEntry === false)).toBe(
      true,
    );
  });

  it("a mixed handler: one allowlisted route and one mutating route flags", () => {
    const root = makeRoot();
    put(root, "forge/os/flow/git.ts", FIXTURE_GIT_TS);
    const file = put(
      root,
      "src/commands/g3.ts",
      `import { git } from "../../forge/os/flow/git.ts";
export const cmdG = {
  name: "g.mixed",
  mutatesState: false,
  execute: async (input: any, ctx: any) => {
    await git(ctx.workspaceRoot, ctx.io, ["rev-parse", "HEAD"]);
    await git(ctx.workspaceRoot, ctx.io, ["push", "origin", "main"]);
  },
};\n`,
    );
    const scanner = createSourceScanner(root);
    const slices = scanner.handlerSlices(file, "g.mixed");
    // One non-allowlisted route into git() flips the whole body back to a hit.
    expect(ratchetExecHits(root, slices)).toEqual([expect.stringContaining("git.ts")]);
  });
});

// ---------------------------------------------------------------------------
// RFC-1501 AC-9/AC-10 — argv-shaped entries (forbid / maxPositionals)
// ---------------------------------------------------------------------------

describe("RFC-1501: the scan reads the argv-shaped allowlist entries", () => {
  it("AC-9: git(root, io, ['for-each-ref', 'refs/tags']) reports no exec hit", () => {
    const root = makeRoot();
    put(root, "forge/os/flow/git.ts", FIXTURE_GIT_TS);
    const file = put(
      root,
      "src/commands/g9.ts",
      `import { git } from "../../forge/os/flow/git.ts";
export const cmdG = {
  name: "g.tags",
  mutatesState: false,
  execute: async (input: any, ctx: any) => {
    await git(ctx.workspaceRoot, ctx.io, ["for-each-ref", "refs/tags"]);
  },
};\n`,
    );
    const scanner = createSourceScanner(root);
    const slices = scanner.handlerSlices(file, "g.tags");
    expect(ratchetExecHits(root, slices)).toEqual([]);
  });

  it("AC-10: git(root, io, ['log', '--output', file]) reports an exec hit", () => {
    const root = makeRoot();
    put(root, "forge/os/flow/git.ts", FIXTURE_GIT_TS);
    const file = put(
      root,
      "src/commands/g10.ts",
      `import { git } from "../../forge/os/flow/git.ts";
export const cmdG = {
  name: "g.logout",
  mutatesState: false,
  execute: async (input: any, ctx: any) => {
    const file = "/tmp/out.txt";
    await git(ctx.workspaceRoot, ctx.io, ["log", "--output", file]);
  },
};\n`,
    );
    const scanner = createSourceScanner(root);
    const slices = scanner.handlerSlices(file, "g.logout");
    expect(ratchetExecHits(root, slices)).toEqual([expect.stringContaining("git.ts")]);
  });

  it("a forbid-only entry with a dynamic range reports no exec hit (runtime judges the range)", () => {
    const root = makeRoot();
    put(root, "forge/os/flow/git.ts", FIXTURE_GIT_TS);
    const file = put(
      root,
      "src/commands/g11.ts",
      `import { git } from "../../forge/os/flow/git.ts";
export const cmdG = {
  name: "g.count",
  mutatesState: false,
  execute: async (input: any, ctx: any) => {
    const range = String(input.flags.range);
    await git(ctx.workspaceRoot, ctx.io, ["rev-list", "--count", range]);
  },
};\n`,
    );
    const scanner = createSourceScanner(root);
    const slices = scanner.handlerSlices(file, "g.count");
    expect(ratchetExecHits(root, slices)).toEqual([]);
  });

  it("an abbreviated forbidden literal (ls-remote --upload=…) reports an exec hit", () => {
    const root = makeRoot();
    put(root, "forge/os/flow/git.ts", FIXTURE_GIT_TS);
    const file = put(
      root,
      "src/commands/g12.ts",
      `import { git } from "../../forge/os/flow/git.ts";
export const cmdG = {
  name: "g.remote",
  mutatesState: false,
  execute: async (input: any, ctx: any) => {
    const url = String(input.flags.url);
    await git(ctx.workspaceRoot, ctx.io, ["ls-remote", "--upload=touch x", url]);
  },
};\n`,
    );
    const scanner = createSourceScanner(root);
    const slices = scanner.handlerSlices(file, "g.remote");
    expect(ratchetExecHits(root, slices)).toEqual([expect.stringContaining("git.ts")]);
  });

  it("a constrained entry with an all-literal argv carrying a forbidden flag still hits", () => {
    const root = makeRoot();
    put(root, "forge/os/flow/git.ts", FIXTURE_GIT_TS);
    const file = put(
      root,
      "src/commands/g11.ts",
      `import { git } from "../../forge/os/flow/git.ts";
export const cmdG = {
  name: "g.symref",
  mutatesState: false,
  execute: async (input: any, ctx: any) => {
    await git(ctx.workspaceRoot, ctx.io, ["symbolic-ref", "HEAD", "refs/heads/x"]);
  },
};\n`,
    );
    const scanner = createSourceScanner(root);
    const slices = scanner.handlerSlices(file, "g.symref");
    expect(ratchetExecHits(root, slices)).toEqual([expect.stringContaining("git.ts")]);
  });
});

// ---------------------------------------------------------------------------
// AC-3/AC-8 — child commands judged by their declaration
// ---------------------------------------------------------------------------

describe("AC-3/AC-8: child commands resolve by name, never by descent", () => {
  const CHILD_GIT = `import { executeKernelCommand } from "../exec-stub.ts";
export const cmdK = {
  name: "k.parent",
  mutatesState: false,
  execute: async (input: any, ctx: any) => {
    await executeKernelCommand({ workspaceRoot: ctx.workspaceRoot, commandName: "k.child" });
  },
};\n`;

  it("AC-3: executeKernelCommand never descends into the executor source", () => {
    const root = makeRoot();
    // A fixture executor that, if descended into, would flag io.exec.
    put(
      root,
      "src/exec-stub.ts",
      `export async function executeKernelCommand(options: any): Promise<any> {
  return options.io.exec("kernel", ["run"]);
}\n`,
    );
    const file = put(root, "src/commands/k.ts", CHILD_GIT);
    const scanner = createSourceScanner(root);
    const childCalls: import("./kernel-source-scan.ts").ChildCommandCall[] = [];
    const slices = scanner.handlerSlices(file, "k.parent", undefined, childCalls);
    // The executor's own io.exec is never reached — no slice from exec-stub.
    expect(slices.every((s) => !s.file.endsWith("exec-stub.ts"))).toBe(true);
    expect(execHitLocs(root, slices)).toEqual([]);
  });

  it("AC-8: a literal mutating child produces a child call record", () => {
    const root = makeRoot();
    put(
      root,
      "src/exec-stub.ts",
      `export async function executeKernelCommand(options: any): Promise<any> { return {}; }\n`,
    );
    const file = put(root, "src/commands/k.ts", CHILD_GIT);
    const scanner = createSourceScanner(root, {
      resolveCommandDeclaration: (name) =>
        name === "k.child" ? { mutatesState: true } : undefined,
    });
    const childCalls: import("./kernel-source-scan.ts").ChildCommandCall[] = [];
    scanner.handlerSlices(file, "k.parent", undefined, childCalls);
    expect(childCalls).toHaveLength(1);
    expect(childCalls[0].command).toBe("k.child");
  });

  it("an unresolvable child name truncates the scan (dynamic-child)", () => {
    const root = makeRoot();
    put(
      root,
      "src/exec-stub.ts",
      `export async function executeKernelCommand(options: any): Promise<any> { return {}; }\n`,
    );
    const file = put(
      root,
      "src/commands/k2.ts",
      `import { executeKernelCommand } from "../exec-stub.ts";
export const cmdK = {
  name: "k.dynamic",
  mutatesState: false,
  execute: async (input: any, ctx: any) => {
    const name = Math.random() > 0 ? "a" : "b";
    await executeKernelCommand({ workspaceRoot: ctx.workspaceRoot, commandName: name });
  },
};\n`,
    );
    const scanner = createSourceScanner(root, {
      resolveCommandDeclaration: () => ({ mutatesState: false }),
    });
    const stats = { unresolved: false, truncated: false };
    const childCalls: import("./kernel-source-scan.ts").ChildCommandCall[] = [];
    scanner.handlerSlices(file, "k.dynamic", stats, childCalls);
    expect(stats.truncated).toBe(true);
    expect(stats.limit).toBe("dynamic-child");
    expect(childCalls).toEqual([]);
  });

  it("for-of over a const string array resolves every element", () => {
    const root = makeRoot();
    put(
      root,
      "src/exec-stub.ts",
      `export async function executeKernelCommand(options: any): Promise<any> { return {}; }\n`,
    );
    const file = put(
      root,
      "src/commands/k3.ts",
      `import { executeKernelCommand } from "../exec-stub.ts";
const CHILDREN = ["k.a", "k.b"];
export const cmdK = {
  name: "k.batch",
  mutatesState: false,
  execute: async (input: any, ctx: any) => {
    for (const child of CHILDREN) {
      await executeKernelCommand({ workspaceRoot: ctx.workspaceRoot, commandName: child });
    }
  },
};\n`,
    );
    const scanner = createSourceScanner(root, {
      resolveCommandDeclaration: (name) => ({ mutatesState: name === "k.b" }),
    });
    const childCalls: import("./kernel-source-scan.ts").ChildCommandCall[] = [];
    scanner.handlerSlices(file, "k.batch", undefined, childCalls);
    expect(childCalls.map((c) => c.command).sort()).toEqual(["k.a", "k.b"]);
  });
});
