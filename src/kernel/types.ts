/*
<MODULE_CONTRACT>
<purpose>Defines types and interfaces for kernel command execution and logging within the application framework.</purpose>
<non-goals>
  <item>Do not implement command execution logic or side effects.</item>
  <item>Do not handle raw input parsing or transport orchestration.</item>
  <item>Do not manage application lifecycle or state outside of defined commands.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>Kernel command contracts must stay explicit so agents cannot pass untyped command inputs.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1130: qa.independent.run cacheable + cacheBypassFlags

Steps 1-4: cacheBypassFlags field on KernelCommandDefinition, executor bypass at both cache call sites (hasCacheBypassFlag), qa.independent.run flipped to cacheable with narrowed reads + modulePaths, 14 new contract tests.</item>
  <item>RFC-1133: cache direct executeKernelCommand executions with flag-keyed results</item>
  <item>ADR-0089: kernel and shared code must not depend on ambient process state

KernelRuntimeContext is the explicit-context carrier (workspaceRoot, site, workpieceEnv) — command handlers and shared code must not fall back to process.cwd() or process.env.NODE_ENV for correctness; callers pass roots and modes explicitly.</item>
  <item>RFC-1144: run read-only steps to completion in collect-errors pipeline mode

Scheduler: collectErrors option on executeScheduledSteps — read-only steps (ScheduledStep.readOnly, executor-resolved from mutatesState === false) run after dependency failures with ranAfterFailedDependency annotation; ranTainted set propagates taint transitively so mutating dependents still skip. Executor: mergeCollectErrorsOption OR-merges PipelineDeclaration.collectErrors with the CLI flag at registry resolution; readOnly annotated post-buildSchedule; taint flag copied to step reports; tainted failures marked in pretty output. Contracts: PipelineDeclaration.collectErrors, KernelExecutionReport.ranAfterFailedDependency, pipelines maps store full declarations. Declarations: collectErrors on validation-gate registrations (build.post, check, build.check, compass, integrity.release in the workpiece template; packages.check in checks module). Tests: 10 new cases covering AC-1..AC-6 plus transitive taint.</item>
  <item>RFC-1147: KernelRegisteredCommandInfo.provider narrowed to workspace | site-module and siteName field removed — runtime site enumeration deleted, the canonical site module set (SITE_MODULE_MAP) is the only site provider.</item>
  <history>RFC-0260, RFC-0267, RFC-0326, RFC-0390, RFC-0518, RFC-0579, RFC-0686, RFC-0960, RFC-1026, RFC-1027, RFC-1028, RFC-1038, RFC-1097, RFC-1126</history>
</CHANGE_SUMMARY>
*/

import type { WorkspaceIO, WriteIntent } from "./workspace-io.ts";
import type { ModuleExport, CommandDeclaration, ActualState } from "./desired-state.ts";
// @ai-invariant: Kernel command contracts must stay explicit so agents cannot pass untyped command inputs.

export type KernelOutputFormat = "pretty" | "json";
export type KernelCommandScope = "app" | "workspace";
export type KernelLogLevel = "info" | "warn" | "error" | "success" | "section";
export type PipelineLogSeverity = "debug" | "info" | "notice" | "warning" | "error";
export type PipelineLogKind =
  "progress" | "expected-fallback" | "advisory" | "external-tool" | "diagnostic" | "error";

export type KernelFlagValue = boolean | string | string[];
export interface DiscoveredSiteWorkspace {
  name: string;
  directory: string;
  toolsDirectory: string;
  configPath?: string;
  packageName?: string;
}

export interface KernelLogEvent {
  level: KernelLogLevel;
  message: string;
  details?: unknown;
  timestamp: string;
  severity?: PipelineLogSeverity;
  kind?: PipelineLogKind;
  command?: string;
  pipeline?: string;
  app?: string;
  packageName?: string;
  module?: string;
  file?: string;
  line?: number;
  ruleId?: string;
  dedupeKey?: string;
  count?: number;
  data?: Record<string, unknown>;
}

export interface KernelLogger {
  section(message: string, details?: unknown): void;
  info(message: string, details?: unknown): void;
  warn(message: string, details?: unknown): void;
  error(message: string, details?: unknown): void;
  success(message: string, details?: unknown): void;
  event(event: Omit<KernelLogEvent, "level" | "timestamp"> & { level?: KernelLogLevel }): void;
  getEvents(): KernelLogEvent[];
}
export interface KernelCommandInput {
  argv: string[];
  flags: Record<string, KernelFlagValue>;
}

export interface KernelCommandMetadata {
  description: string;
  scope: KernelCommandScope;
  mutatesState?: boolean;
  /**
   * RFC-1176: permits `io.exec` on the read-only adapter — the command
   * declares `mutatesState: false` but legitimately shells out for
   * read-only probes (git log/ls-files/diff, `which`, binary `-ver`).
   * Subprocesses bypass filesystem interception by nature; the flag makes
   * the declaration honest. All direct WorkspaceIO mutations still throw
   * KERNEL-META-01. Direct child_process/fs usage is flagged by the
   * registry-integrity gate regardless. Meaningful only with
   * `mutatesState: false`.
   */
  execOnReadOnly?: boolean;
  /**
   * RFC-1176: flag names whose truthy presence upgrades this invocation to
   * a real (or `--dry-run` recording) adapter even though the command
   * declares `mutatesState: false` — flag-gated mutating modes such as
   * `--write-baseline` or `--auto-accept`. The declaration stays `false`
   * so pipeline scheduling (collectErrors read-only continuation) treats
   * the step as read-only; the mutation capability is exercised only when
   * the flag is explicitly passed. Meaningful only with
   * `mutatesState: false`.
   */
  mutatingFlags?: string[];
  requiresNetwork?: boolean;
  supportsAllSites?: boolean;
  timeoutMs?: number;
  expectedDurationMs?: number;
  longRunning?: boolean;
  /**
   * RFC-0390: when false, the pipeline executor never caches this command's
   * result. Required for commands that depend on external state (network,
   * secrets, time). Commands without `reads` MUST set this to false;
   * command.reads.validate enforces this. Defaults to true.
   */
  cacheable?: boolean;
  /**
   * RFC-1130: flag names that bypass the result cache when present in argv
   * (`--name` or `--name=value` forms). Both the cache read and the cache
   * write are skipped — for flags that reduce coverage (e.g. `--rfc`).
   */
  cacheBypassFlags?: string[];
  /**
   * RFC-0518: declarative gate metadata. Optional. When present, describes the
   * gate's severity, phase, conditional logic, surfaces protected, rules enforced,
   * and workflow steps blocked on failure. Consumed by ecosystem.manifest.generate
   * and gate.catalog.generate (RFC-0519). Does NOT affect execution.
   */
  gate?: GateMetadata;
}

// ---------------------------------------------------------------------------
// RFC-0518: declarative gate metadata on command definitions
// ---------------------------------------------------------------------------

export type GateSeverity = "error" | "warning" | "mixed";
export type GatePhase = "author" | "postbuild" | "workspace" | "mission" | "release";

export interface GateConditional {
  kind: "entitlement" | "flag" | "config";
  ref: string;
  description: string;
}

export interface GateMetadata {
  severity: GateSeverity;
  phase: GatePhase;
  conditional?: GateConditional;
  surfaces?: string[];
  rules?: string[];
  blocks?: string[];
}

// ---------------------------------------------------------------------------
// RFC-0260: typed kernel command flag schemas
// ---------------------------------------------------------------------------
// A command that declares `flags` opts into strict parsing: unknown flags are
// rejected (KERNEL-FLAG-01) instead of silently ignored, and required flags
// are enforced (KERNEL-FLAG-03) before `execute()` runs. Commands without a
// `flags` schema keep the legacy heuristic-parser behavior unchanged.

export interface KernelFlagSpec {
  kind: "boolean" | "string" | "string[]";
  required?: boolean;
  default?: KernelFlagValue;
  /** One-line description; consumed by --help and future generators (rfc-0266). */
  description: string;
}

export interface KernelRegisteredCommandInfo extends KernelCommandMetadata {
  name: string;
  /**
   * "workspace" — registered by the workspace-root kernel config.
   * "site-module" — registered by the canonical site module set (SITE_MODULE_MAP, RFC-1148).
   */
  provider: "workspace" | "site-module";
  /** The name of the KernelModule that registered this command. */
  module?: string;
  /** RFC-0260: declared flag schema, when the command opts in. */
  flags?: Record<string, KernelFlagSpec>;
  /** RFC-0266: declared IO globs, when the command opts in. */
  reads?: string[];
  writes?: string[];
  /** RFC-0687: propagated from KernelCommandDefinition for manifest and registry. */
  validatesOutputs?: string[];
  /** RFC-0960: declared generated artifacts, propagated from KernelCommandDefinition. */
  generates?: GeneratedArtifactSpec[];
  /**
   * RFC-1028: repo-relative path to the module's src/ directory (e.g.
   * "packages/werkstatt-engine/src"). Derived from KernelCommandDefinition.modulePath
   * (RFC-0960) by taking everything up to and including the src/ segment.
   * Used by the pipeline executor to resolve moduleSrcDir for computeModuleHash.
   */
  moduleBasePath?: string;
}

export interface KernelNextStep {
  action: string;
  kind: "required" | "optional";
}

export interface KernelCommandResult<TData = unknown> {
  data?: TData;
  exitCode?: number;
  summary?: string;
  timing?: KernelCommandTiming;
  nextSteps?: KernelNextStep[];
}

// ---------------------------------------------------------------------------
// RFC-0852: canonical Diagnostic model — re-exported from engine schema module
// ---------------------------------------------------------------------------
// The single shape every static check uses to report a finding. The Zod
// schemas, types, limits, and validation helpers are owned by
// `packages/werkstatt/src/schemas/diagnostic.ts` (RFC-0852). This file
// re-exports the types so existing `@warpgogol/werkstatt-engine/kernel` consumers
// see no breakage. The site plugin imports the schemas directly from
// `@warpgogol/werkstatt-engine/schemas`.

import type {
  DiagnosticSeverity as _DiagnosticSeverity,
  DiagnosticEvidence as _DiagnosticEvidence,
  Diagnostic as _Diagnostic,
} from "./diagnostic.ts";
import { createDefaultIO } from "@warpgogol/werkstatt-shared/kernel/workspace-io";

export type {
  DiagnosticSeverity,
  DiagnosticEvidence,
  Diagnostic,
  RemediationRef,
} from "./diagnostic.ts";

/** Canonical per-command result payload carried inside KernelCommandResult.data. */
export interface CheckResult {
  command: string;
  status: "pass" | "warn" | "fail";
  diagnostics: _Diagnostic[];
  summary: { error: number; warning: number; info: number };
}

/**
 * RFC-0960: Declared generated artifact specification on a kernel command.
 * Lives on `KernelCommandDefinition.generates[]` and is the source of truth
 * for the derived generator ownership map.
 */
export interface GeneratedArtifactSpec {
  /** Workpiece-relative path or glob, e.g. "src/content/system-health.generated.yaml". */
  path: string;
  /** Skip absence checks (RFC-0636 semantics) — e.g. produced only in build.post. */
  conditional?: boolean;
  /** Pipeline phase that produces it: informs which validator phase may assert existence. */
  phase: "build.prepare" | "build.post" | "on-demand";
  /**
   * Override the default markerPolicy derivation. Default: public/** → "registry-only",
   * everything else → "embedded". Set explicitly only for edge cases (e.g. .cache/pdf/**).
   */
  markerPolicy?: "embedded" | "registry-only";
  /**
   * Committed bytes contain non-deterministic fields (Ed25519 proofs, real-time
   * created/generatedAt timestamps, build durations) — byte-compare against a
   * dryRun render can never pass. generated.drift.validate skips volatile
   * artifacts; existence/staleness/signature checks still apply elsewhere.
   */
  volatile?: boolean;
}

/**
 * RFC-0960: A derived entry in the generator ownership map. Produced by
 * `buildGeneratorOwnership(registry)` from all registered commands' `generates[]`.
 * Engine defines the structural type; the site plugin owns the concrete derivation.
 */
export interface GeneratorOwnershipEntry {
  command: string;
  modulePath?: string;
  artifact: GeneratedArtifactSpec;
  markerPolicy: "embedded" | "registry-only";
}

export interface KernelRuntimeContext {
  workspaceRoot: string;
  site?: DiscoveredSiteWorkspace;
  /** True only when --site <name> was passed explicitly by the caller. False when site was resolved by cwd inference. */
  siteExplicit: boolean;
  logger: KernelLogger;
  dryRun: boolean;
  /** RFC-0635: when true, injected into input.flags.force by executeRegisteredCommand. */
  force?: boolean;
  outputFormat: KernelOutputFormat;
  /**
   * RFC-0267: the WorkspaceIO port. The executor selects the adapter:
   * read-only (throws KERNEL-META-01 on mutation) for `mutatesState: false`
   * commands, recording (captures intents, touches nothing) under
   * `--dry-run`, else the default fs-backed adapter. Ambient `node:fs`
   * imports in unmigrated command modules keep working — adoption is
   * ratcheted, new-code-first.
   */
  io: WorkspaceIO;
  /**
   * RFC-0326: the WriteIntent[] captured by the tracing adapter during this
   * invocation. Set by the executor from `createDefaultIO().intents` (real
   * runs) or `createRecordingIO().intents` (dry runs). Absent for read-only
   * commands (no mutations possible). The executor converts these to
   * `filesModified` on the execution report.
   */
  fileIntents?: WriteIntent[];
  /** RFC-1038: the actual state, available to validators for derived projections like buildGeneratorOwnership. */
  actualState: ActualState;
  /**
   * RFC-0960: pre-computed derived generator ownership map. Computed once by
   * the executor via dynamic import of buildGeneratorOwnership from the site
   * plugin. Validators consume this instead of a static constant.
   */
  ownershipMap?: GeneratorOwnershipEntry[];
  /**
   * RFC-1126: parsed `.env` of the resolved site workspace (mission workpiece
   * for mission.* commands, cache clone otherwise). Populated by the executor
   * from `context.site.directory/.env` via dotenv.parse; absent or empty when
   * no site is resolved or no .env exists. Fallback only — `process.env`
   * always wins: `process.env["KEY"] ?? context.workpieceEnv?.get("KEY")`.
   */
  workpieceEnv?: ReadonlyMap<string, string>;
  /**
   * RFC-1133: per-invocation command-result cache carrier. Pipeline executors
   * populate it with the shared layer plus `treeIndex`/`moduleHashCache`
   * amortization; `executeKernelCommand` sets `{ layer }` once per invocation.
   * When absent, `executeRegisteredCommand` lazily opens a layer for that call.
   */
  resultCache?: KernelResultCacheContext;
}

/**
 * RFC-1133: narrow structural port over the engine's `CacheLayer`.
 * werkstatt-shared cannot import engine types (SHARED-04), so the carrier is
 * declared here and satisfied structurally — `CacheLayer` needs no explicit
 * `implements`.
 */
export interface KernelResultCacheStore {
  readonly available: boolean;
  get(namespace: string, key: string): Promise<{ data: unknown } | null>;
  set(
    namespace: string,
    key: string,
    data: unknown,
    mtime: number,
    contentHash: string,
  ): Promise<void>;
  close(): Promise<void>;
}

/**
 * RFC-1133: cache structures shared across one pipeline run or one direct
 * `executeKernelCommand` invocation.
 */
export interface KernelResultCacheContext {
  layer: KernelResultCacheStore;
  /** Pipeline-only: workspace tree index enabling the mtime fast path (RFC-0685). */
  treeIndex?: Map<string, { mtimeMs: number; size: number }>;
  /** Pipeline-only: per-run module hash memo (RFC-0637). */
  moduleHashCache?: Map<string, string>;
}

/**
 * RFC-1038: KernelCommandDefinition is now a type alias for CommandDeclaration.
 * The generic parameter is preserved for backward compatibility with existing
 * code that uses KernelCommandDefinition<TData>, but the underlying type is
 * CommandDeclaration (which has the same structure).
 */
export type KernelCommandDefinition<_TData = unknown> = CommandDeclaration;
export interface KernelPipelineStep {
  command: string;
  args?: string[];
  timeoutMs?: number;
  expectedDurationMs?: number;
  skip?: boolean;
  skipReason?: string;
  /**
   * RFC-0686: command names that must complete before this step starts.
   * When absent, the step depends on the previous non-skipped step (backward compatible).
   * When empty ([]), the step has no dependencies and may start immediately.
   */
  dependsOn?: string[];
}

/**
 * RFC-1038: KernelModule is now a type alias for ModuleExport.
 * Modules export declarations, commands, and pipelines arrays instead of
 * calling register(). The buildRegistry function reads these arrays directly.
 */
export type KernelModule = ModuleExport;

export type ModuleFiberState =
  "declared" | "loading" | "active" | "draining" | "unloading" | "disposed" | "failed";

export interface KernelAppConfig {
  name?: string;
  description?: string;
  /** Direct module objects — used when moduleLoaders is absent. */
  modules?: ModuleExport[];
  /** Lazy module loaders — enables manifest-driven single-module loading. Functions are defined in kernel.config.ts so import() resolves from the workspace root. */
  moduleLoaders?: Record<string, () => Promise<ModuleExport>>;
}
export interface KernelExecutionReport<TData = unknown> {
  siteName?: string;
  commandName: string;
  data?: TData;
  exitCode: number;
  ok: boolean;
  summary?: string;
  metadata: KernelCommandDefinition<TData>;
  logs: KernelLogEvent[];
  logSummary?: {
    error: number;
    warning: number;
    notice: number;
    expectedFallback: number;
    suppressedDebug: number;
  };
  timing: KernelCommandTiming;
  nextSteps?: KernelNextStep[];
  /**
   * RFC-1027: top remediation hints aggregated from failed diagnostics.
   * Sorted by occurrence count descending, capped at 3 entries.
   * Absent when the command produced no diagnostics with remediation data.
   */
  remediationHints?: RemediationHint[];
  /**
   * RFC-0326: workspace-root-relative POSIX paths of files this command
   * actually wrote, mkdir'd, or removed during this invocation. Empty array
   * when no mutations occurred or when the command is unmigrated (ambient
   * node:fs, IO-01 baseline). Derived from the tracing adapter's WriteIntent[].
   */
  filesModified?: string[];
  /** RFC-0390: true when this report was served from the command-result cache instead of real execution. */
  cached?: boolean;
  /**
   * RFC-1144: step ran despite a failed, failure-skipped, or tainted
   * transitive dependency (collect-errors mode only). Signals the result
   * may be a cascaded secondary failure.
   */
  ranAfterFailedDependency?: boolean;
}

/**
 * RFC-1027: A structured remediation hint aggregated from failed diagnostics.
 * Derived from Diagnostic.remediation fields, grouped by ruleId, sorted by occurrence count.
 */
export interface RemediationHint {
  ruleId: string;
  action: string;
  template?: string;
  docRef?: string;
  targetFiles?: string[];
  occurrenceCount: number;
}

export interface KernelPipelineReport {
  siteName?: string;
  pipelineName: string;
  exitCode: number;
  ok: boolean;
  steps: KernelExecutionReport[];
  timing: KernelPipelineTimingSummary;
  /**
   * RFC-0326: deduplicated union of all step reports' filesModified arrays.
   */
  filesModified?: string[];
  /**
   * RFC-0809: command names of steps that failed (excluding dependency-skipped).
   * Present only in collect-errors mode when failures occurred.
   */
  failedSteps?: string[];
}

export type PipelineStepStatus = "pass" | "warn" | "fail" | "skipped" | "timeout";

export interface KernelCommandTiming {
  durationMs: number;
  timeoutMs?: number;
  expectedDurationMs?: number;
  exceededTimeout: boolean;
}

export interface PipelineStepTiming extends KernelCommandTiming {
  pipeline: string;
  command: string;
  app?: string;
  packageName?: string;
  status: PipelineStepStatus;
  startedAtMonotonicMs: number;
  endedAtMonotonicMs: number;
  fromCache?: boolean;
}

export interface KernelPipelineTimingSummary {
  pipeline: string;
  app?: string;
  /** Wall-clock duration: min(startedAt) to max(endedAt) across all steps. */
  totalDurationMs: number;
  /** Sum of per-step durationMs — equals totalDurationMs for sequential execution, exceeds it for parallel. */
  summedDurationMs?: number;
  stepCount: number;
  slowestSteps: PipelineStepTiming[];
  timeoutCount: number;
  warningCount: number;
  failedStep?: string;
}

export interface ExecuteKernelCommandOptions {
  workspaceRoot: string;
  commandName: string;
  siteName?: string;
  allSites?: boolean;
  argv?: string[];
  dryRun?: boolean;
  /** RFC-0635: when true, bypasses distribution reuse check in mission.validate. Injected into input.flags.force by the executor. */
  force?: boolean;
  outputFormat?: KernelOutputFormat;
  /** Set to true when siteName was derived from an explicit --site flag, not cwd inference. */
  siteExplicit?: boolean;
}

export interface ExecuteKernelPipelineOptions {
  workspaceRoot: string;
  pipelineName: string;
  siteName?: string;
  allSites?: boolean;
  dryRun?: boolean;
  outputFormat?: KernelOutputFormat;
  /** RFC-0390: when true, bypass cache reads for a full re-execution. Successful results are still written. */
  force?: boolean;
  /** Pre-resolved site workspace — bypasses site discovery when provided (e.g. for closed-mission workpieces). */
  siteWorkspace?: DiscoveredSiteWorkspace;
  /** RFC-0686: maximum number of steps to run concurrently. Default: Math.min(os.availableParallelism(), 8). When 1, full sequential mode (ignores dependsOn, abort-on-failure). */
  concurrency?: number;
  /** RFC-0732: pipeline-level flags merged into each step's KernelCommandInput.flags. Step-level flags take precedence. */
  flags?: Record<string, unknown>;
  /**
   * RFC-0809: when true, continue executing independent steps after a failure
   * and aggregate all errors in the final report. Default: false (fail-fast).
   * RFC-1144: OR-merged with `PipelineDeclaration.collectErrors` — either
   * opt-in enables the mode; under collect-errors the failure cascade skips
   * only mutating dependents while read-only steps run annotated.
   */
  collectErrors?: boolean;
}

export interface SiteWorkspacesListResult {
  workspaceRoot: string;
  sites: DiscoveredSiteWorkspace[];
}
export function defineKernelConfig(config: KernelAppConfig): KernelAppConfig {
  return config;
}
