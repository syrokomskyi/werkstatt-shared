/*
<MODULE_CONTRACT>
<purpose>runTool — the single subprocess seam for stack plugins (RFC-1100). Owns the
shared prologue every external-binary call needs: dist/ preflight, required-env
presence check, env merge, timeout, and error mapping to ToolResult. Production
uses the default execFileSync adapter; tests inject a recording ToolExecutor so no
test mocks node:child_process.</purpose>

<non-goals>
  <item>Does not validate tool-specific config — callers check their own config fields before calling runTool.</item>
  <item>Does not use shell interpolation — execFile with an argument array only (DNA-89).</item>
  <item>Does not run in the browser — server-only (Node child_process).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1100: initial subprocess seam — runTool + ToolSpec/ToolResult/ToolExecutor; replaces per-call-site execFileSync prologues in stack plugins.</item>
  <item>RFC-1100: step 1 — shared tool/fs/check seams (walkFiles, runTool, defineStackChecks)</item>
</CHANGE_SUMMARY>
*/

// Server-only. Do not import from browser/client scripts.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface ToolSpec {
  /** Binary to execute, e.g. "npx". */
  bin: string;
  /** Argument array — never a shell string (DNA-89). */
  args: string[];
  /** Working directory for the subprocess. */
  cwd: string;
  /** Extra environment merged over process.env for the subprocess. */
  env?: Record<string, string>;
  /** Subprocess timeout. Default 120_000 ms. */
  timeoutMs?: number;
  /** Preflight: require <cwd>/dist to exist before executing. */
  requireDist?: boolean;
  /** Preflight: require these env vars to be non-empty after the env merge. */
  requireEnv?: string[];
}

export interface ToolResult {
  success: boolean;
  stdout?: string;
  errors?: string[];
  /** Which phase produced the failure — lets callers keep preflight messages unwrapped. */
  failedAt?: "preflight" | "exec";
}

/**
 * Executes a ToolSpec. Injectable so tests record specs instead of spawning
 * processes — pass a fake that captures the spec and returns a canned ToolResult.
 */
export type ToolExecutor = (spec: ToolSpec) => ToolResult;

const DEFAULT_TIMEOUT_MS = 120_000;

const execFileExecutor: ToolExecutor = (spec) => {
  try {
    const stdout = execFileSync(spec.bin, spec.args, {
      cwd: spec.cwd,
      encoding: "utf-8",
      timeout: spec.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...spec.env },
    });
    return { success: true, stdout };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, errors: [message], failedAt: "exec" };
  }
};

export function runTool(spec: ToolSpec, executor: ToolExecutor = execFileExecutor): ToolResult {
  if (spec.requireDist) {
    const distDir = join(spec.cwd, "dist");
    if (!existsSync(distDir)) {
      return {
        success: false,
        errors: [`dist/ directory not found at ${distDir} — run build first`],
        failedAt: "preflight",
      };
    }
  }

  if (spec.requireEnv && spec.requireEnv.length > 0) {
    const mergedEnv = { ...process.env, ...spec.env };
    const missing = spec.requireEnv.filter((name) => !mergedEnv[name]);
    if (missing.length > 0) {
      return {
        success: false,
        errors: missing.map(
          (name) => `Required environment variable ${name} is not set`,
        ),
        failedAt: "preflight",
      };
    }
  }

  try {
    return executor(spec);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, errors: [message], failedAt: "exec" };
  }
}
