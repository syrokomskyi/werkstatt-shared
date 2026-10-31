/*
<MODULE_CONTRACT>
<purpose>RFC-1463 gate conventions — AC-1: KernelCommandMetadata accepts an
`ensure` array + `compositeGate` marker + `ensureConditions` resolvers;
AC-4: runCompositeGate executes every independent successor within the same
run and records ordering-dependent successors as skipped with the blocking
step id.</purpose>
<non-goals>
  <item>Declaration-lint enforcement against the live registry is covered by the engine-side ensure tests — this suite pins contract shape and runner semantics on fixtures.</item>
</non-goals>
</MODULE_CONTRACT>
*/

import { describe, expect, it } from "vitest";

import { CompositeGateGraphError, runCompositeGate } from "./composite-gate.ts";
import type {
  EnsureDecl,
  KernelCommandDefinition,
} from "./types.ts";

describe("RFC-1463 AC-1 — ensure/compositeGate metadata contract", () => {
  it("KernelCommandDefinition accepts ensure, ensureConditions, compositeGate", () => {
    const definition: KernelCommandDefinition = {
      name: "fixture.gate",
      mutatesState: false,
      description: "fixture",
      scope: "workspace",
      compositeGate: true,
      ensure: [
        { command: "playwright.chromium.ensure", when: "browser-checks" } satisfies EnsureDecl,
        { command: "cache.warm" },
      ],
      ensureConditions: {
        "browser-checks": (input) => input.flags["skip-e2e"] !== true,
      },
      execute: async () => ({ exitCode: 0 }),
    };
    expect(definition.ensure).toHaveLength(2);
    expect(definition.ensureConditions?.["browser-checks"]({ argv: [], flags: {} })).toBe(true);
    expect(
      definition.ensureConditions?.["browser-checks"]({ argv: [], flags: { "skip-e2e": true } }),
    ).toBe(false);
    expect(definition.compositeGate).toBe(true);
  });
});

describe("RFC-1463 AC-4 — runCompositeGate reaches every independent step", () => {
  it("failed step does not abort independent successors; dependent steps skip with blockedBy", async () => {
    const ran: string[] = [];
    const result = await runCompositeGate([
      { id: "a", run: async () => (ran.push("a"), { status: "fail", diagnostics: [{ ruleId: "X-1", severity: "error", message: "a failed" }] }) },
      { id: "b", run: async () => (ran.push("b"), { status: "pass" }) },
      { id: "c", dependsOn: ["a"], run: async () => (ran.push("c"), { status: "pass" }) },
      { id: "d", dependsOn: ["c"], run: async () => (ran.push("d"), { status: "pass" }) },
      { id: "e", run: async () => (ran.push("e"), { status: "fail", diagnostics: [{ ruleId: "X-2", severity: "error", message: "e failed" }] }) },
    ]);

    expect(ran).toEqual(["a", "b", "e"]);
    expect(result.ok).toBe(false);
    expect(result.summary).toEqual({ pass: 1, fail: 2, skipped: 2 });
    expect(result.steps.map((s) => s.status)).toEqual(["fail", "pass", "skipped", "skipped", "fail"]);
    // Transitive skip: d's blocker is the root failure a, not the skipped c.
    expect(result.steps[2].blockedBy).toBe("a");
    expect(result.steps[3].blockedBy).toBe("a");
    expect(result.steps[0].diagnostics[0].ruleId).toBe("X-1");
  });

  it("all-pass run reports ok with zero skipped", async () => {
    const result = await runCompositeGate([
      { id: "a", run: async () => ({ status: "pass" }) },
      { id: "b", dependsOn: ["a"], run: async () => ({ status: "pass" }) },
    ]);
    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ pass: 2, fail: 0, skipped: 0 });
  });

  it("a throwing step records fail with GATE-CMP-02 — later independent steps still run", async () => {
    const ran: string[] = [];
    const result = await runCompositeGate([
      { id: "a", run: async () => { throw new Error("a exploded"); } },
      { id: "b", run: async () => (ran.push("b"), { status: "pass" }) },
    ]);
    expect(ran).toEqual(["b"]);
    expect(result.ok).toBe(false);
    expect(result.steps[0].status).toBe("fail");
    expect(result.steps[0].diagnostics[0].ruleId).toBe("GATE-CMP-02");
    expect(result.steps[0].diagnostics[0].message).toContain("a exploded");
  });

  it("a malformed dependsOn graph throws CompositeGateGraphError — never a false-green all-skip", async () => {
    await expect(
      runCompositeGate([
        { id: "a", dependsOn: ["b"], run: async () => ({ status: "pass" }) },
        { id: "b", dependsOn: ["a"], run: async () => ({ status: "pass" }) },
      ]),
    ).rejects.toThrow(CompositeGateGraphError);
    await expect(
      runCompositeGate([
        { id: "a", dependsOn: ["missing"], run: async () => ({ status: "pass" }) },
      ]),
    ).rejects.toThrow(CompositeGateGraphError);
  });

  it("failFast restores first-failure abort — later steps never run and are not recorded", async () => {
    const ran: string[] = [];
    const result = await runCompositeGate(
      [
        { id: "a", run: async () => (ran.push("a"), { status: "fail", diagnostics: [] }) },
        { id: "b", run: async () => (ran.push("b"), { status: "pass" }) },
      ],
      { failFast: true },
    );
    expect(ran).toEqual(["a"]);
    expect(result.steps).toHaveLength(1);
    expect(result.summary).toEqual({ pass: 0, fail: 1, skipped: 0 });
  });
});
