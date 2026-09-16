/*
<MODULE_CONTRACT>
<purpose>defineStackChecks — the spec-driven check harness for stack plugins
(RFC-1100). A plugin declares one StackCheckSpec table; the harness derives kernel
command declarations, the checkGate hook body, and invariant table rows from it.
Validator files keep only a pure check() function — they never shape
KernelCommandResult or register commands themselves.</purpose>

<non-goals>
  <item>Does not implement stack-specific rules — those live in the plugin's check() functions.</item>
  <item>Does not read files — check() functions consume the plugin's model/walker seams.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1100: initial spec-driven check harness — StackCheckSpec, StackCheckViolation, StackCheckData, defineStackChecks returning commands + runCheckGate + invariantRows.</item>
  <item>RFC-1100: step 1 — shared tool/fs/check seams (walkFiles, runTool, defineStackChecks)</item>
</CHANGE_SUMMARY>
*/

import type {
  KernelCommandDefinition,
  KernelCommandResult,
} from "@warpgogol/werkstatt-engine/kernel/types";
import type { HookResult, PluginHookContext } from "../plugin/plugin-contract.ts";

/** A single rule violation emitted by a stack check() function. */
export interface StackCheckViolation {
  ruleId: string;
  file: string;
  message: string;
  line?: number;
  details?: Record<string, unknown>;
}

/** Uniform data payload every stack check command returns. */
export interface StackCheckData {
  command: string;
  status: "pass" | "fail";
  violations: StackCheckViolation[];
}

export interface StackCheckSpec {
  /** Kernel command name, e.g. "phaser.scenes.validate". */
  name: string;
  /** Human-readable command description. */
  description: string;
  /** The single contract this check enforces (DNA-91). */
  contract: string;
  /** Rule IDs this check emits (DNA-91). */
  rules: string[];
  /** Workspace-relative path globs this check reads (RFC-0266). */
  reads: string[];
  /** Invariant ID for invariantRows — defaults to rules[0]. */
  invariantId?: string;
  /** Pure rule logic: project root in, violations out. */
  check: (projectRoot: string) => Promise<StackCheckViolation[]>;
}

export interface StackCheckDeclarations {
  /** Kernel command declarations, one per spec entry. */
  commands: KernelCommandDefinition<StackCheckData>[];
  /** The plugin's checkGate hook body — runs every spec in order. */
  runCheckGate: (ctx: PluginHookContext) => Promise<HookResult>;
  /** Invariant table rows derived from the spec — { id, command } pairs. */
  invariantRows: Array<{ id: string; command: string }>;
}

function toCommand(spec: StackCheckSpec): KernelCommandDefinition<StackCheckData> {
  return {
    name: spec.name,
    description: spec.description,
    contract: spec.contract,
    rules: spec.rules,
    reads: spec.reads,
    scope: "workspace",
    cacheable: false,
    async execute(_input, context): Promise<KernelCommandResult<StackCheckData>> {
      const violations = await spec.check(context.workspaceRoot);
      const status = violations.length === 0 ? "pass" : "fail";
      return {
        data: { command: spec.name, status, violations },
        exitCode: status === "pass" ? 0 : 1,
        summary: `${spec.name}: ${status} (${violations.length} violations)`,
      };
    },
  };
}

/** Short gate-log label: "phaser.scenes.validate" → "scenes". */
function gateLabel(commandName: string): string {
  return commandName.split(".")[1] ?? commandName;
}

export function defineStackChecks(specs: StackCheckSpec[]): StackCheckDeclarations {
  const commands = specs.map(toCommand);

  async function runCheckGate(ctx: PluginHookContext): Promise<HookResult> {
    const projectRoot = ctx.workpiecePath ?? ctx.workspaceRoot;
    const errors: string[] = [];
    const statuses: string[] = [];

    for (const spec of specs) {
      const violations = await spec.check(projectRoot);
      const status = violations.length === 0 ? "pass" : "fail";
      statuses.push(`${gateLabel(spec.name)}=${status}`);
      if (violations.length > 0) {
        errors.push(`${spec.name}: ${violations.length} violations`);
      }
    }

    ctx.logger.info(`checkGate: ${statuses.join(", ")}`);

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  const invariantRows = specs
    .map((spec) => ({ id: spec.invariantId ?? spec.rules[0], command: spec.name }))
    .filter((row): row is { id: string; command: string } => typeof row.id === "string");

  return { commands, runCheckGate, invariantRows };
}
