import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runTool } from "./run-tool.ts";
import type { ToolSpec, ToolResult, ToolExecutor } from "./run-tool.ts";

function recordingExecutor(
  calls: ToolSpec[],
  result: ToolResult = { success: true, stdout: "ok" },
): ToolExecutor {
  return (spec) => {
    calls.push(spec);
    return result;
  };
}

describe("runTool", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "run-tool-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("passes the spec to the executor and returns its result", () => {
    const calls: ToolSpec[] = [];
    const result = runTool(
      { bin: "npx", args: ["vite", "build"], cwd, timeoutMs: 5_000 },
      recordingExecutor(calls),
    );

    expect(result.success).toBe(true);
    expect(result.stdout).toBe("ok");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.bin).toBe("npx");
    expect(calls[0]!.args).toEqual(["vite", "build"]);
    expect(calls[0]!.cwd).toBe(cwd);
    expect(calls[0]!.timeoutMs).toBe(5_000);
  });

  it("fails preflight when requireDist and dist/ is missing", () => {
    const calls: ToolSpec[] = [];
    const result = runTool(
      { bin: "npx", args: ["deploy"], cwd, requireDist: true },
      recordingExecutor(calls),
    );

    expect(result.success).toBe(false);
    expect(result.failedAt).toBe("preflight");
    expect(result.errors?.[0]).toContain("dist/ directory not found");
    expect(calls).toHaveLength(0);
  });

  it("passes preflight when requireDist and dist/ exists", async () => {
    await mkdir(join(cwd, "dist"), { recursive: true });
    const calls: ToolSpec[] = [];
    const result = runTool(
      { bin: "npx", args: ["deploy"], cwd, requireDist: true },
      recordingExecutor(calls),
    );

    expect(result.success).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("fails preflight when a required env var is missing", () => {
    const calls: ToolSpec[] = [];
    const result = runTool(
      { bin: "npx", args: ["x"], cwd, requireEnv: ["DEFINITELY_MISSING_ENV_VAR"] },
      recordingExecutor(calls),
    );

    expect(result.success).toBe(false);
    expect(result.failedAt).toBe("preflight");
    expect(result.errors?.[0]).toContain("DEFINITELY_MISSING_ENV_VAR");
    expect(calls).toHaveLength(0);
  });

  it("passes preflight when a required env var comes from spec.env", () => {
    const calls: ToolSpec[] = [];
    const result = runTool(
      {
        bin: "npx",
        args: ["x"],
        cwd,
        env: { MY_TOKEN: "secret" },
        requireEnv: ["MY_TOKEN"],
      },
      recordingExecutor(calls),
    );

    expect(result.success).toBe(true);
    expect(calls[0]!.env?.MY_TOKEN).toBe("secret");
  });

  it("fails preflight when a required env var is empty after merge", () => {
    const calls: ToolSpec[] = [];
    const result = runTool(
      {
        bin: "npx",
        args: ["x"],
        cwd,
        env: { EMPTY_TOKEN: "" },
        requireEnv: ["EMPTY_TOKEN"],
      },
      recordingExecutor(calls),
    );

    expect(result.success).toBe(false);
    expect(result.failedAt).toBe("preflight");
  });

  it("maps an executor throw to an exec failure", () => {
    const throwing: ToolExecutor = () => {
      throw new Error("spawn npx ENOENT");
    };
    const result = runTool({ bin: "npx", args: ["x"], cwd }, throwing);

    expect(result.success).toBe(false);
    expect(result.failedAt).toBe("exec");
    expect(result.errors?.[0]).toContain("spawn npx ENOENT");
  });

  it("propagates executor failure results unchanged", () => {
    const calls: ToolSpec[] = [];
    const result = runTool(
      { bin: "npx", args: ["x"], cwd },
      recordingExecutor(calls, { success: false, errors: ["exit 1"], failedAt: "exec" }),
    );

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(["exit 1"]);
  });
});
