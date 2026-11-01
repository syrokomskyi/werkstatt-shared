/*
<MODULE_CONTRACT>
<purpose>
  RFC-1456: canonical vocabulary for the service health probing contour —
  the closed HealthProbeKind set, declaration/result schemas, aggregation
  semantics, and the per-kind+substrate default-probe resolver. Lives in
  werkstatt-shared so the werkstatt-site registry validator and the
  werkstatt-engine probe executors consume one source of truth (DNA-64:
  engine never imports from site packages).
</purpose>
<non-goals>
  <item>No probe execution — executors live in werkstatt-engine; this module is pure types + pure resolution.</item>
  <item>No registry/IO — callers pass the service's declared kind + substrate signal.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>The kind set is a closed const tuple — validator and executor dispatch derive from one array.</item>
  <item>Defaults discriminate by deployment substrate, not the kind label — scheduled-worker spans both.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1456: initial implementation — closed probe vocabulary + per-substrate defaults.</item>
  <item>RFC-1456: service health probing contour</item>
  <item>RFC-1485: sweep compass headers — shared-tail</item>
</CHANGE_SUMMARY>
*/

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const SERVICE_HEALTH_PROBE_KINDS = [
  "http-liveness",
  "upstream-reachability",
  "functional",
  "process-liveness",
  "queue-depth",
  "delegate-command",
] as const;

export type HealthProbeKind = (typeof SERVICE_HEALTH_PROBE_KINDS)[number];

export type HealthProbeSeverity = "required" | "advisory";

/** Declaration shape for `healthProbes[]` entries in service.config.yaml. */
export interface HealthProbeDeclaration {
  kind: HealthProbeKind;
  /** Optional label — defaults to the kind. */
  name?: string;
  severity?: HealthProbeSeverity;
  timeoutMs?: number;
  config?: Record<string, unknown>;
}

export const SERVICE_HEALTH_DEFAULT_TIMEOUT_MS = 10_000;

export interface HealthProbeResult {
  kind: HealthProbeKind;
  name: string;
  severity: HealthProbeSeverity;
  ok: boolean;
  detail?: string;
  durationMs: number;
}

export type ServiceHealthState = "healthy" | "degraded" | "unhealthy";

export interface ServiceHealthResult {
  command: "leitstand.service.health";
  service: string;
  state: ServiceHealthState;
  probes: HealthProbeResult[];
  checkedAt: string;
  /** Set when the probe run itself failed — per-service isolation in health-poll (state reads unhealthy). */
  error?: string;
}

export interface ServiceHealthPollResult {
  command: "leitstand.service.health-poll";
  services: ServiceHealthResult[];
  alerts: Array<{ service: string; attempted: boolean; sent: boolean; detail?: string }>;
}

/** Persisted per-service health record — services/&lt;id&gt;/.health/status.json (Q-9 sidecar). */
export interface LastHealthCheck {
  at: string;
  state: ServiceHealthState;
  probes: HealthProbeResult[];
  consecutiveFailures: number;
}

export type ServiceKind =
  | "cloudflare-worker"
  | "proxy-worker"
  | "scheduled-worker"
  | "integration-worker"
  | "node-runner"
  | "compose-stack";

export type ServiceSubstrate = "cloudflare" | "node" | "compose";

const CLOUDFLARE_KINDS: ReadonlySet<ServiceKind> = new Set([
  "cloudflare-worker",
  "proxy-worker",
  "scheduled-worker",
  "integration-worker",
]);

/**
 * CF-substrate kinds — the registry validator's workerName/wrangler.jsonc
 * requirements (SVC-REG-03/05/07) apply only to these.
 */
export function isCloudflareKind(kind: string): boolean {
  return CLOUDFLARE_KINDS.has(kind as ServiceKind);
}

/**
 * Substrate detection — `wrangler.jsonc` present =&gt; Cloudflare; otherwise
 * compose-stack =&gt; compose; everything else =&gt; node.
 */
export function substrateForService(kind: string, hasWranglerConfig: boolean): ServiceSubstrate {
  if (hasWranglerConfig) return "cloudflare";
  if (kind === "compose-stack") return "compose";
  return "node";
}

/**
 * Per-kind+substrate default probes when service.config.yaml declares no
 * `healthProbes`. Node-substrate scheduled workers SHOULD declare explicit
 * probes rather than rely on defaults (RFC-1456).
 */
export function defaultProbesForService(
  kind: string,
  substrate: ServiceSubstrate,
  upstreams: readonly string[] = [],
): HealthProbeDeclaration[] {
  if (substrate === "compose") {
    return [{ kind: "delegate-command", name: "observability.stack.health", severity: "required" }];
  }
  if (substrate === "node") {
    return [{ kind: "process-liveness", severity: "required" }];
  }
  // cloudflare substrate
  if (kind === "proxy-worker") {
    const upstreamProbes: HealthProbeDeclaration[] = upstreams.map((u) => ({
      kind: "upstream-reachability",
      name: u,
      severity: "required",
      config: { upstream: u },
    }));
    return [{ kind: "http-liveness", severity: "required" }, ...upstreamProbes];
  }
  return [{ kind: "http-liveness", severity: "required" }];
}

/** Aggregate probe results into the service state per RFC-1456. */
export function aggregateHealthState(probes: readonly HealthProbeResult[]): ServiceHealthState {
  if (probes.length === 0) return "unhealthy";
  if (probes.some((p) => p.severity === "required" && !p.ok)) return "unhealthy";
  if (probes.some((p) => !p.ok)) return "degraded";
  return "healthy";
}

// --- Heartbeat writer (Node-only; services write their own heartbeat) ---

export interface ServiceHeartbeat {
  at: string;
  cycle: { ok: boolean; detail?: string };
}

/**
 * Write `services/<id>/.health/heartbeat.json` — called by Node-loop
 * services at the end of every work cycle (RFC-1456 heartbeat contract).
 * Returns the written path. Best-effort callers may ignore the return.
 */
export function writeServiceHeartbeat(
  serviceDir: string,
  cycle: { ok: boolean; detail?: string },
  at: Date = new Date(),
): string {
  const dir = join(serviceDir, ".health");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "heartbeat.json");
  const payload: ServiceHeartbeat = { at: at.toISOString(), cycle };
  writeFileSync(file, JSON.stringify(payload) + "\n");
  return file;
}
