import { describe, it, expect } from "vitest";
import { defineStackChecks } from "./stack-checks.ts";
import type { StackCheckData, StackCheckSpec, StackCheckViolation } from "./stack-checks.ts";
import type { PluginHookContext } from "../plugin/plugin-contract.ts";
import type {
  KernelCommandInput,
  KernelCommandResult,
  KernelRuntimeContext,
} from "@warpgogol/werkstatt-engine/kernel/types";

const PASS_SPEC: StackCheckSpec = {
  name: "stack.alpha.validate",
  description: "alpha check",
  contract: "stack",
  rules: ["STACK-01"],
  reads: ["src/**"],
  check: async () => [],
};

const FAIL_VIOLATION: StackCheckViolation = {
  ruleId: "STACK-02",
  file: "src/bad.ts",
  message: "bad thing",
};

const FAIL_SPEC: StackCheckSpec = {
  name: "stack.beta.validate",
  description: "beta check",
  contract: "stack",
  rules: ["STACK-02"],
  reads: ["src/**"],
  check: async () => [FAIL_VIOLATION],
};

function makeCtx(projectRoot: string): PluginHookContext {
  return {
    workspaceRoot: projectRoot,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  } as unknown as PluginHookContext;
}

function makeRuntimeContext(projectRoot: string): KernelRuntimeContext {
  return { workspaceRoot: projectRoot } as unknown as KernelRuntimeContext;
}

const INPUT: KernelCommandInput = { argv: [], flags: {} };

describe("defineStackChecks", () => {
  it("emits one command per spec with metadata from the spec", () => {
    const { commands } = defineStackChecks([PASS_SPEC, FAIL_SPEC]);

    expect(commands).toHaveLength(2);
    expect(commands[0]!.name).toBe("stack.alpha.validate");
    expect(commands[0]!.description).toBe("alpha check");
    expect(commands[0]!.contract).toBe("stack");
    expect(commands[0]!.rules).toEqual(["STACK-01"]);
    expect(commands[0]!.reads).toEqual(["src/**"]);
    expect(commands[0]!.scope).toBe("workspace");
    expect(commands[0]!.cacheable).toBe(false);
  });

  it("command execute returns the uniform pass envelope", async () => {
    const { commands } = defineStackChecks([PASS_SPEC]);
    const result = (await commands[0]!.execute(
      INPUT,
      makeRuntimeContext("/tmp/x"),
    )) as KernelCommandResult<StackCheckData>;

    expect(result?.exitCode).toBe(0);
    expect(result?.data?.command).toBe("stack.alpha.validate");
    expect(result?.data?.status).toBe("pass");
    expect(result?.data?.violations).toEqual([]);
    expect(result?.summary).toContain("stack.alpha.validate");
    expect(result?.summary).toContain("pass");
  });

  it("command execute returns the uniform fail envelope with violations", async () => {
    const { commands } = defineStackChecks([FAIL_SPEC]);
    const result = (await commands[0]!.execute(
      INPUT,
      makeRuntimeContext("/tmp/x"),
    )) as KernelCommandResult<StackCheckData>;

    expect(result?.exitCode).toBe(1);
    expect(result?.data?.status).toBe("fail");
    expect(result?.data?.violations).toEqual([FAIL_VIOLATION]);
    expect(result?.summary).toContain("1 violations");
  });

  it("runCheckGate succeeds when all checks pass", async () => {
    const { runCheckGate } = defineStackChecks([PASS_SPEC]);
    const result = await runCheckGate(makeCtx("/tmp/x"));

    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("runCheckGate aggregates failures across specs", async () => {
    const { runCheckGate } = defineStackChecks([PASS_SPEC, FAIL_SPEC]);
    const result = await runCheckGate(makeCtx("/tmp/x"));

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(["stack.beta.validate: 1 violations"]);
  });

  it("runCheckGate prefers workpiecePath over workspaceRoot", async () => {
    let seen = "";
    const spec: StackCheckSpec = {
      ...PASS_SPEC,
      check: async (root) => {
        seen = root;
        return [];
      },
    };
    const { runCheckGate } = defineStackChecks([spec]);
    const ctx = {
      ...makeCtx("/workspace"),
      workpiecePath: "/workpiece",
    };
    await runCheckGate(ctx);

    expect(seen).toBe("/workpiece");
  });

  it("derives invariantRows from rules[0] by default", () => {
    const { invariantRows } = defineStackChecks([PASS_SPEC, FAIL_SPEC]);

    expect(invariantRows).toEqual([
      { id: "STACK-01", command: "stack.alpha.validate" },
      { id: "STACK-02", command: "stack.beta.validate" },
    ]);
  });

  it("honours explicit invariantId and skips rule-less specs", () => {
    const custom: StackCheckSpec = { ...PASS_SPEC, invariantId: "STACK-CUSTOM" };
    const ruleless: StackCheckSpec = { ...FAIL_SPEC, rules: [] };
    const { invariantRows } = defineStackChecks([custom, ruleless]);

    expect(invariantRows).toEqual([{ id: "STACK-CUSTOM", command: "stack.alpha.validate" }]);
  });
});
