/*
<MODULE_CONTRACT>
<purpose>
  RFC-1210: closed-loop remediation contracts — the closed `remediationClasses`
  catalog, the `RemediationSignal` intake record, the per-site
  `remediation` autonomy block (`system-state.yaml`), and the default signal
  source allowlist. The catalog is closed by policy: promoting a class to
  autoFixable requires a follow-up RFC, not an ad-hoc edit.
</purpose>
<non-goals>
  <item>Does not route or ingest signals — that is the engine's remediation.signal.ingest command.</item>
  <item>Does not own the remediation hint catalog (REMEDIATION_CATALOG in remediation-catalog.ts) — this module classifies defect classes, that module maps ruleIds to fix text.</item>
  <item>Does not open missions — the open step is an internal composition inside the ingest command.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1210: initial contracts — signal schema, autonomy config, closed autoFixable catalog (generated-drift, workpiece-deps, typography) with real registered fixCommands, default signal-source allowlist.</item>
  <item>RFC-1210: closed-loop signal ingest to bounded missions (RFC-1210)</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

// ---------------------------------------------------------------------------
// RemediationSignal — normalized intake record (gogol.remediation-signal/1)
// ---------------------------------------------------------------------------

export const REMEDIATION_SIGNAL_SCHEMA = "gogol.remediation-signal/1" as const;

export const remediationSignalSchema = z.object({
  schema: z.literal(REMEDIATION_SIGNAL_SCHEMA),
  /** Sternsystem id the signal targets. */
  siteId: z.string().min(1),
  /** Key into the closed remediationClasses catalog. */
  class: z.string().min(1),
  /** Invoker id — MUST be in the site's remediation.signalSources allowlist. */
  source: z.string().min(1),
  /** Detector kind — provenance metadata, not an authorization input. */
  detectedBy: z.enum(["signoz-alert", "fleet-probe", "check-runner", "validator", "manual"]),
  /** File paths, probe run ids, alert urls — carried into mission evidence. */
  evidenceRefs: z.array(z.string().min(1)).default([]),
  detectedAt: z.string().datetime(),
});

export type RemediationSignal = z.infer<typeof remediationSignalSchema>;

// ---------------------------------------------------------------------------
// RemediationAutonomyConfig — `remediation:` block in system-state.yaml
// ---------------------------------------------------------------------------

/**
 * Default signal-source allowlist (AUDIT-RFC-1210-01 + operator decision):
 * the trust boundary for ingest — an invoker not listed here cannot trigger
 * any route, not even a deduped one.
 */
export const DEFAULT_REMEDIATION_SIGNAL_SOURCES = [
  "operator",
  "leitstand",
  "observability-bridge",
] as const;

export const remediationAutonomyConfigSchema = z.object({
  /** off = ingest produces action-packs only; bounded = autoFixable classes open bounded missions. */
  autonomy: z.enum(["off", "bounded"]).default("off"),
  /** Allowlist of invoker ids accepted by remediation.signal.ingest. */
  signalSources: z.array(z.string().min(1)).default([...DEFAULT_REMEDIATION_SIGNAL_SOURCES]),
});

export type RemediationAutonomyConfig = z.infer<typeof remediationAutonomyConfigSchema>;

// ---------------------------------------------------------------------------
// RemediationClassEntry — closed catalog of defect classes
// ---------------------------------------------------------------------------

export const remediationClassEntrySchema = z
  .object({
    /** Defect class key, e.g. "generated-drift". */
    class: z.string().min(1),
    /** true only when the class's fix is a proven deterministic command. */
    autoFixable: z.boolean(),
    /** Registered kernel/site command the auto-mission runs — required iff autoFixable. */
    fixCommand: z.string().min(1).optional(),
    /** Per-site rate cap on auto-missions for this class per rolling day (0 = never — meaningful for non-autoFixable entries). */
    maxAutoMissionsPerDay: z.number().int().min(0),
    /** Minimum signal severity for this class to route (informational floor). */
    severityFloor: z.enum(["warning", "error"]),
  })
  .refine((e) => !e.autoFixable || typeof e.fixCommand === "string", {
    message: "autoFixable entries require fixCommand",
    path: ["fixCommand"],
  });

export type RemediationClassEntry = z.infer<typeof remediationClassEntrySchema>;

/**
 * RFC-1210 closed v1 catalog. autoFixable classes map to real registered
 * commands (verified by remediation.autonomy.validate against the workspace
 * registry):
 *
 * - `generated-drift` → `mission.build` — a workpiece build re-runs every
 *   build.post generator, deterministically re-emitting drifted artifacts.
 * - `workpiece-deps` → `config.regenerate` — regenerates the workpiece
 *   package.json from WORKPIECE_DEPENDENCY_MANIFEST (the fixHint
 *   template.deps.drift already emits).
 * - `typography` → `typography.fix` — mechanical whitelisted typography fixes.
 *
 * Extending this catalog requires a follow-up RFC (closed-by-policy).
 */
export const REMEDIATION_CLASSES: readonly RemediationClassEntry[] = [
  {
    class: "generated-drift",
    autoFixable: true,
    fixCommand: "mission.build",
    maxAutoMissionsPerDay: 1,
    severityFloor: "warning",
  },
  {
    class: "workpiece-deps",
    autoFixable: true,
    fixCommand: "config.regenerate",
    maxAutoMissionsPerDay: 1,
    severityFloor: "warning",
  },
  {
    class: "typography",
    autoFixable: true,
    fixCommand: "typography.fix",
    maxAutoMissionsPerDay: 2,
    severityFloor: "warning",
  },
  {
    class: "content-regression",
    autoFixable: false,
    maxAutoMissionsPerDay: 0,
    severityFloor: "warning",
  },
  {
    class: "agent-surface",
    autoFixable: false,
    maxAutoMissionsPerDay: 0,
    severityFloor: "warning",
  },
  {
    class: "runtime-health",
    autoFixable: false,
    maxAutoMissionsPerDay: 0,
    severityFloor: "error",
  },
];

/**
 * Resolve a catalog entry by class key. Returns undefined for unknown classes —
 * callers MUST reject unknown classes (no ad-hoc classes, RFC-1210).
 */
export function lookupRemediationClass(name: string): RemediationClassEntry | undefined {
  return REMEDIATION_CLASSES.find((e) => e.class === name);
}

/**
 * Catalog integrity check — parse every entry and assert the autoFixable→
 * fixCommand invariant. Returns the list of structural issues (empty = valid).
 */
export function validateRemediationClasses(): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const entry of REMEDIATION_CLASSES) {
    const parsed = remediationClassEntrySchema.safeParse(entry);
    if (!parsed.success) {
      issues.push(
        `class "${entry.class}": ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      );
      continue;
    }
    if (seen.has(entry.class)) {
      issues.push(`duplicate class key "${entry.class}"`);
    }
    seen.add(entry.class);
    if (entry.autoFixable && entry.maxAutoMissionsPerDay < 1) {
      issues.push(`class "${entry.class}" is autoFixable but has a zero rate cap`);
    }
  }
  return issues;
}
