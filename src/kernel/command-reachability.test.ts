/*
<MODULE_CONTRACT>
<purpose>command-reachability.test coverage — computeCommandReachability produces structural edges only, in deterministic order.</purpose>
<non-goals>
  <item>Not a coverage-validator suite — COVERAGE-01..03 semantics are covered by command.coverage.validate tests.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1334: tests for AC-11 and edge ordering.</item>
  <item>RFC-1334: steps 1-3 — shared structural reachability, reachableVia in the command manifest, coverage validator on the shared scan</item>
  <item>RFC-1334: steps 1-3 — shared structural reachability, manifest reachableVia, shared coverage scan</item>
  <item>RFC-1485: sweep compass headers — shared-tail</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";
import { computeCommandReachability } from "./command-reachability.ts";

describe("computeCommandReachability (RFC-1334)", () => {
  it("records no mention edges", () => {
    const edges = computeCommandReachability({
      commands: [{ name: "demo.validate" }],
      sources: new Map([["AGENTS.md", "Run `pnpm exec werkstatt run demo.validate`."]]),
    });
    expect(edges.get("demo.validate")).toEqual([]);
  });

  it("emits sorted pipeline, invoker, and coverage edges", () => {
    const edges = computeCommandReachability({
      commands: [{ name: "demo.validate", pipelines: ["packages.check"], coverage: "operator" }],
      sources: new Map([
        ["packages/x/src/b.ts", 'await executeKernelCommand("demo.validate", {});'],
        ["packages/x/src/a.ts", 'await executeKernelCommand("demo.validate", {});'],
      ]),
    });
    expect(edges.get("demo.validate")).toEqual([
      { kind: "pipeline", ref: "packages.check" },
      { kind: "invoker", ref: "packages/x/src/a.ts" },
      { kind: "invoker", ref: "packages/x/src/b.ts" },
      { kind: "coverage", ref: "operator" },
    ]);
  });
});
