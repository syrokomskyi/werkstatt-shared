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
  <item>RFC-1385: close RFC-1385 review warnings — invoke siteWorkspace forwarding, error-path closedWrites, AC-4 hook clause</item>
  <item>RFC-1385: stamp RFC-1385 implemented</item>
  <item>RFC-1461: declare rules[] severity via CommandRuleDecl workspace-wide (RFC-1461)</item>
  <item>RFC-1463: composite gates report complete violation sets and self-ensure prerequisites — ensure/compositeGate metadata, executor ensure runner, blockedBy skip tracking, ENSURE-01..04 + GATE-CMP-01, runCompositeGate</item>
  <item>RFC-1463: address review r1 findings — dependsOn graph pre-validation, ensureChain invoke-port propagation, unregistered-target ENSURE-04, thrown-step GATE-CMP-02, preflight skipped surfacing</item>
  <history>ADR-0089, RFC-0260, RFC-0267, RFC-0326, RFC-0390, RFC-0518, RFC-0579, RFC-0686, RFC-0960, RFC-1026, RFC-1027, RFC-1028, RFC-1038, RFC-1097, RFC-1126, RFC-1130, RFC-1133, RFC-1144, RFC-1147, RFC-1193, RFC-1231, RFC-1260, RFC-1303, RFC-1306, RFC-1327, RFC-1354, RFC-1366, RFC-1369, RFC-1385</history>
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
  /**
   * Resolution source — set by the engine site-workspace resolver. Absent on
   * workspaces synthesized by other paths (e.g. closed-mission audits).
   * Read-only commands may target any source; mutating commands are
   * executor-guarded to mission workpieces (RFC-1260, COPS-07 class).
   */
  source?: "apps" | "mission" | "cache-clone";
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

/**
 * RFC-1243: reachability class consumed by `command.coverage.validate`.
 * - `operator` — entry point is a runbook, prompt, or manual invocation.
 * - `ci` — invoked by CI or external automation outside this workspace.
 * - `delegated` — invoked programmatically by another command through
 *   dynamic dispatch the literal-invocation scan cannot see.
 * Absent = undeclared → COVERAGE-01 when no literal invocation exists.
 */
export type KernelCommandCoverage = "operator" | "ci" | "delegated";

/**
 * RFC-1366: a declared env input — `name` matches `^[A-Z_][A-Z0-9_]*$`;
 * `required: true` names are enforced by the kernel's KERNEL-ENV-01
 * pre-handler gate (process.env → workpieceEnv, empty string = absent);
 * `required: false` entries participate only in the result-cache digest.
 */
export interface EnvInputDecl {
  name: string;
  required: boolean;
}

/** RFC-1461: declared severity for a rule id emitted by a validator or gate. */
export type CommandRuleSeverity = "error" | "warning";

/** RFC-1461: `rules[]` entry — rule id plus its declared emission severity. */
export interface CommandRuleDecl {
  id: string;
  severity: CommandRuleSeverity;
}

export interface KernelCommandMetadata {
  description: string;
  scope: KernelCommandScope;
  /**
   * Filesystem-scoped mutation capability. When true, the executor grants a
   * mutating WorkspaceIO adapter and the command MUST declare `writes`
   * (CMD-MAN-02). Covers only mutations performed through this command's own
   * adapter — remote-port, in-memory-store, and delegated writes are out of
   * scope: an `executeKernelCommand` call attributes its writes to the callee,
   * whose own declaration owns those paths. A read-only orchestrator (e.g.
   * `indexnow.submit` → `bordbuch.append`) therefore stays
   * `mutatesState: false`; it MUST NOT re-declare the callee's writes — a
   * false declaration carrying writes is caught by
   * MUTATES-STATE-WRITES-MISMATCH, and shared generated paths collide under
   * GENERATES-PATH-COLLISION.
   */
  mutatesState?: boolean;
  /**
   * RFC-1243: reachability class — see KernelCommandCoverage. Declared only
   * when the command has no literal invocation surface; commands reachable
   * from pipelines, STEPS arrays, or docs leave this unset.
   */
  coverage?: KernelCommandCoverage;
  /**
   * RFC-1243: names the invocation surface justifying `coverage` (runbook
   * name, CI workflow, dispatching command). Required for `delegated` —
   * command.coverage.validate emits COVERAGE-03 when it is absent or names
   * no registered caller; recommended for `operator`/`ci`.
   */
  coverageNote?: string;
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
  /**
   * RFC-1303: environment variable names whose values this command reads
   * (`process.env.*` reachable from its handler). Declared inputs are hashed
   * — never the raw values — into the result-cache key on both read paths,
   * so `cacheable` results cannot replay a verdict computed under a different
   * environment. Names only (`^[A-Z_][A-Z0-9_]*$`). Undeclared env reads on a
   * cacheable command emit ENV-INPUT-01 (error); on non-cacheable commands,
   * a warning.
   * RFC-1366: entries carry `required` — the kernel's KERNEL-ENV-01 gate
   * resolves `required: true` names against `process.env` then
   * `context.workpieceEnv` (empty string counts as absent) before the
   * handler runs. `required: false` entries are digest-only.
   */
  envInputs?: EnvInputDecl[];
  /**
   * RFC-1303: directory prefixes (e.g. `".cache/"`) that this
   * `mutatesState: false` command may legitimately write — cache-class
   * artifacts only. Prefixes are workspace-relative by default; the
   * `<app>/` token resolves against the per-site app directory and
   * absolute paths pass through as-is (executor expands both). Every
   * entry must resolve to a git-ignored path (CACHE-WRITE-01). Writes
   * outside the declared prefixes still throw KERNEL-META-01.
   */
  cacheWrites?: string[];
  /**
   * The command performs network egress — remote APIs, git push, DHT or
   * other distributed calls. Informational manifest metadata; it does not
   * gate the read-only adapter (network is not WorkspaceIO-governed).
   */
  requiresNetwork?: boolean;
  /**
   * RFC-1231: when true, the command accepts the reserved `--all` token
   * (`assertAllFlagAccepted` stays fail-closed otherwise). Effect follows
   * scope: app-scope commands fan out over all sites via `ensureTargetSites`;
   * workspace commands — and uniformly app-scope ones too — receive the
   * consumed value re-injected as `input.flags.all` when the schema declares
   * an `all` flag. Declaring `all` without this field is KERNEL-FLAG-09.
   */
  acceptsAllFlag?: boolean;
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
   * RFC-1316: opts this blocking validator into delta mode against
   * docs/validation-baseline.generated.yaml — diagnostics matching the
   * recorded key set report as known-debt (info) instead of failing the run;
   * `--strict` bypasses the baseline. Declaring it contractually requires
   * ruleId+file+message on every emitted diagnostic (line is advisory-only).
   */
  baselineEligible?: boolean;
  /**
   * RFC-0518: declarative gate metadata. Optional. When present, describes the
   * gate's severity, phase, conditional logic, surfaces protected, rules enforced,
   * and workflow steps blocked on failure. Consumed by ecosystem.manifest.generate
   * and gate.catalog.generate (RFC-0519). Does NOT affect execution.
   */
  gate?: GateMetadata;
  /**
   * RFC-1327: rerun-safety class for mutating lifecycle/provisioning commands.
   * `rerun-safe` — a second run on converged state is a no-op exit-0 (requires a
   * sibling `*.rerun.test.ts`, enforced by command.idempotency.validate IDEMP-02);
   * `resume-only` — safe via `--resume`/journal continuation, a plain re-run may
   * repeat remote or destructive effects; `not-idempotent` — re-running has
   * side effects and `idempotencyNote` must say what (IDEMP-03). Meaningful only
   * with `mutatesState: true`.
   */
  idempotency?: "rerun-safe" | "resume-only" | "not-idempotent";
  /** RFC-1327: explains the class — required for `not-idempotent`, recommended for `resume-only`. */
  idempotencyNote?: string;
  /**
   * RFC-1463: declared self-ensure — deterministic prerequisites the executor
   * runs inside pre-flight before the command's first check. Each target must
   * resolve to a registered command with `mutatesState: false` or
   * `idempotency: "rerun-safe"` (declaration lint, blocking — self-ensure may
   * prepare, never decide). `when` names a key in `ensureConditions`; absent
   * `when` means the ensure runs on every invocation.
   */
  ensure?: EnsureDecl[];
  /**
   * RFC-1463: named ensure conditions resolved executor-side pre-dispatch
   * against the command's declared plan inputs (flags, targeting). An
   * `ensure[].when` value not present here is a declaration-lint failure —
   * never silently skipped.
   */
  ensureConditions?: Record<string, EnsureConditionResolver>;
  /**
   * RFC-1463: marks the command as a composite gate for GATE-CMP-01
   * completeness scanning — the gate reports the complete violation set
   * across independent checks in one invocation; a marked command whose
   * runner still returns on first failure is flagged.
   */
  compositeGate?: boolean;
}

/** RFC-1463: one declared self-ensure target — see `KernelCommandMetadata.ensure`. */
export interface EnsureDecl {
  /** Registered command name to run pre-flight (read-only or rerun-safe only). */
  command: string;
  /** Named condition key resolved against `ensureConditions` pre-dispatch. */
  when?: string;
}

/** RFC-1463: executor-side ensure condition — reads the resolved invocation input. */
export type EnsureConditionResolver = (input: KernelCommandInput) => boolean;

/** RFC-1463: one recorded self-ensure outcome on `KernelExecutionReport.ensured`. */
export interface EnsureRecord {
  /** The ensure target command name. */
  command: string;
  status: "ensured" | "skipped" | "failed";
  /** Present when status === "skipped" — the `when` condition that resolved false. */
  when?: string;
  exitCode?: number;
  durationMs: number;
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
  rules?: CommandRuleDecl[];
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
   * RFC-1028: repo-relative path to the module's src/ or os/ directory (e.g.
   * "packages/werkstatt-engine/src", "packages/forge/os"). Derived from
   * KernelCommandDefinition.modulePath (RFC-0960) by taking everything up to
   * and including the first /src/ or /os/ segment (RFC-1193).
   * Used by the pipeline executor to resolve moduleSrcDir for computeModuleHash.
   */
  moduleBasePath?: string;
  /**
   * RFC-1193: raw repo-relative module file path propagated from
   * KernelCommandDefinition.modulePath. Validators need it to distinguish
   * `unpatched` (absent) from `unrooted` (present but no /src/ or /os/ segment).
   */
  modulePath?: string;
  /**
   * RFC-1194: declared allowlist of paths relative to dirname(modulePath),
   * propagated from KernelCommandDefinition. Validators (CRC-05) gate that
   * each entry resolves to an existing path under the module file's dir.
   */
  modulePaths?: string[];
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
  /**
   * RFC-1231: true when `--all` was passed on the invocation. Injected into
   * `input.flags.all` by executeRegisteredCommand when the command declares an
   * `all` flag and passed the `acceptsAllFlag` gate.
   */
  allSites?: boolean;
  /**
   * RFC-1385: scoped closed-rebuild write mode — when true, the closed-workpiece
   * guard admits mutating commands on `.closed` workpieces and journals their
   * writes as `closedWrites`. Only `release.prepare` may bind this flag;
   * commits stay blocked by the RFC-0878 workpiece hook.
   */
  allowClosedWrites?: boolean;
  /**
   * RFC-1463: the active self-ensure chain — command names whose ensure
   * blocks are already executing on this call stack. Executor-internal:
   * an ensure target already in the chain resolves as a declaration error
   * (cycle), never an infinite recursion.
   */
  ensureChain?: string[];
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
   * RFC-1126/1366: parsed `.env` of the resolved workspace — the site's `.env`
   * for app-scoped commands, `missions/<id>/workpiece/.env` when `--mission`
   * resolves on any command. Populated by `executeRegisteredCommand`; absent
   * or empty when no site/mission resolves or no .env exists. Fallback only —
   * `process.env` always wins: `process.env["KEY"] || context.workpieceEnv?.get("KEY")`
   * (`||`, not `??` — an empty-string process value counts as absent).
   */
  workpieceEnv?: ReadonlyMap<string, string>;
  /**
   * RFC-1133: per-invocation command-result cache carrier. Pipeline executors
   * populate it with the shared layer plus `treeIndex`/`moduleHashCache`
   * amortization; `executeKernelCommand` sets `{ layer }` once per invocation.
   * When absent, `executeRegisteredCommand` lazily opens a layer for that call.
   */
  resultCache?: KernelResultCacheContext;
  /**
   * RFC-1306: optional sibling-command invocation port — populated by the
   * executor on every command execution so commands can delegate by name
   * (e.g. `rfc.evidence.sync`'s regeneration chain) without importing the
   * engine. The child goes through `executeKernelCommand` with its own flag
   * resolution and io adapter; workspaceRoot, the resolved site selector,
   * dryRun, and outputFormat are inherited from the invoking context.
   * Absent under autonomous hosts (standalone `forge` CLI) — consumers must
   * fail closed with a diagnostic, never crash on the absent port.
   *
   * Delegated flags resolve through the child's schema + universal aliases
   * exactly like CLI argv — RFC-1126's `--site`→`--id` alias rewrite applies
   * to `id`-declaring children, so callers must not pass `site` as a flag
   * name to such commands (pass the resolved site via the parent's context
   * instead).
   */
  invoke?: KernelInvokeCommand;
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
  /**
   * RFC-1184: warn-only rollout mode — a failing step is recorded with
   * `warned: true` on its report but does not fail the pipeline nor skip or
   * taint its dependents. Explicit opt-in per step for staged rollout of
   * newly blocking gates; blocking remains the default.
   */
  warnOnly?: boolean;
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
/**
 * RFC-1306: signature of the executor-populated invocation port on
 * `KernelRuntimeContext.invoke` — delegates to a sibling command by name,
 * flags serialized to argv by the executor. Always resolves to a single
 * report (the port never passes `--all`).
 * RFC-1369: `options.siteName` targets an app-scope child explicitly — the
 * serialized `--site` argv is canonical only for workspace-scope children;
 * app-scope commands resolve their site via `executeKernelCommand`'s
 * `siteName` option (ensureTargetSites never reads argv).
 */
export type KernelInvokeCommand = (
  commandName: string,
  flags?: Record<string, KernelFlagValue>,
  options?: { siteName?: string },
) => Promise<KernelExecutionReport>;

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
  /**
   * RFC-1385: workspace-root-relative paths written on a `.closed` workpiece
   * while the scoped `allowClosedWrites` mode was bound — union of declared
   * `writes[]` (resolved inside the site directory) and actual `filesModified`
   * entries under it. Present only when the mode ran and the set is non-empty.
   */
  closedWrites?: string[];
  /** RFC-0390: true when this report was served from the command-result cache instead of real execution. */
  cached?: boolean;
  /**
   * RFC-1144: step ran despite a failed, failure-skipped, or tainted
   * transitive dependency (collect-errors mode only). Signals the result
   * may be a cascaded secondary failure.
   */
  ranAfterFailedDependency?: boolean;
  /**
   * RFC-1463: on a dependency-skipped step report, names the command whose
   * failure blocked this step — the nearest blocking ancestor, not a bare
   * skip reason.
   */
  blockedBy?: string;
  /**
   * RFC-1184: step was declared `warnOnly` and failed — the failure is
   * preserved (exitCode, summary, diagnostics) but `ok` is true so the
   * pipeline continues. Distinguishable from cached/skipped/pass.
   */
  warned?: boolean;
  /**
   * RFC-1463: declared self-ensure outcomes recorded by the executor
   * pre-flight — one entry per `ensure[]` declaration, including
   * condition-skipped targets. Absent when the command declares no ensures
   * or `--no-ensure` bypassed them.
   */
  ensured?: EnsureRecord[];
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
  /** RFC-1309: suppress registry/config loading preamble on stderr; command diagnostics are unaffected. */
  quiet?: boolean;
  /**
   * RFC-1385: permit mutating commands on `.closed` workpieces and journal
   * their writes as `closedWrites`. Only `release.prepare` may set this —
   * the flag is a scoped escape hatch, not a general CLI option.
   */
  allowClosedWrites?: boolean;
  /**
   * Pre-resolved site workspace — bypasses site discovery when provided,
   * overriding `siteName`/`allSites` resolution (mirrors
   * ExecuteKernelPipelineOptions.siteWorkspace). RFC-1385: under the scoped
   * closed-write mode, delegated calls forward the parent's resolved
   * workpiece here — discovery would resolve the cache clone on closed
   * missions (currentMission is null).
   */
  siteWorkspace?: DiscoveredSiteWorkspace;
  /**
   * RFC-1463: the active self-ensure chain inherited by delegated invocations
   * (`context.invoke`) — an ensure target that loops back onto the chain
   * resolves as a declaration error instead of unbounded recursion. Internal
   * executor plumbing, never a CLI option.
   */
  ensureChain?: string[];
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
  /** RFC-1309: suppress pipeline progressLine preamble on stderr; step diagnostics are unaffected. */
  quiet?: boolean;
  /**
   * RFC-1385: permit mutating steps on `.closed` workpieces and journal
   * their writes as `closedWrites` on each step report. Only `release.prepare`
   * may set this — the flag is a scoped escape hatch, not a CLI option.
   */
  allowClosedWrites?: boolean;
}

export interface SiteWorkspacesListResult {
  workspaceRoot: string;
  sites: DiscoveredSiteWorkspace[];
}
export function defineKernelConfig(config: KernelAppConfig): KernelAppConfig {
  return config;
}
