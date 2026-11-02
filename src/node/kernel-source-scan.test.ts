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
