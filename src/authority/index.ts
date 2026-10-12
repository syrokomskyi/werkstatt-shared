/*
<MODULE_CONTRACT>
<purpose>
  RFC-1259: the content-authority resolver — one pure function answering
  "may subject S mutate field F of object O at required level L". Consults
  the CAM `authority:` block when present; falls back to the legacy
  projections (clientEditable[] for studio-gate-client, pseo autonomy scopes
  for pseo-generator, agent-primary posture for agent-session) when absent.

  RFC-1263: hoisted from packages/werkstatt-site/src/domain/authority/resolve.ts
  so the engine's mission.content-edit eligibility check evaluates the same
  model — one resolver, one semantic.
</purpose>
<non-goals>
  <item>Do not emit validator diagnostics — CAM-01..05 live in
  werkstatt-site checks/authority-model-validate.ts; this module returns
  verdicts only.</item>
  <item>Do not read files — callers pass the parsed SystemManifest and any
  resolved pseo scope state; the resolver is pure.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1259: resolver + projections — CAM grants -> pseo scopes ->
  clientEditable precedence with explicit source; Q-1 conservative pseo
  ceiling (L2); Q-25 legacy agent-session passthrough (source
  "legacy-agent").</item>
  <item>RFC-1263: hoisted site -> shared (domain/authority/resolve.ts re-exports
  this module) so engine-side fast-lane eligibility consults the same
  resolver.</item>
  <item>RFC-1263</item>
</CHANGE_SUMMARY>
*/

import picomatch from "picomatch";

import type {
  CamAuthority,
  CamFieldClass,
  CamGate,
  CamGrant,
  CamLevel,
  SystemManifest,
} from "../ontology/schemas/index.ts";
import type { AutonomyState } from "../surface/index.ts";

export const CAM_LEVEL_ORDER: Record<CamLevel, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
};

const LEVEL_NAMES: CamLevel[] = ["L0", "L1", "L2", "L3", "L4"];

export function camLevelToNumber(level: CamLevel): number {
  return CAM_LEVEL_ORDER[level];
}

export function numberToCamLevel(level: number): CamLevel {
  return LEVEL_NAMES[Math.max(0, Math.min(4, Math.floor(level)))];
}

/** Channel-derived subject ids — never caller-supplied (RFC-1259 contract). */
export type CamSubjectId = "agent-session" | "studio-gate-client" | "pseo-generator";

export interface ContentAuthorityQuery {
  subject: CamSubjectId;
  fieldClass: CamFieldClass;
  /** Workspace-relative content path (e.g. "src/content/pages/de/notausgang.md"). */
  path: string;
  locale?: string;
  /** The mutation-scope level the attempted operation requires (0–4). */
  level: number;
}

export interface ContentAuthorityVerdict {
  allowed: boolean;
  /** Effective level for subject×fieldClass×path (numeric 0–4). */
  level: number;
  gates: Array<{
    id: string;
    require: "human-approval" | "mission-digest-signoff" | "provenance";
  }>;
  /**
   * Which projection answered. "legacy-agent" extends the RFC enum: the
   * agent-primary posture (ADR-0108) grants agent-session within the content
   * tree when no CAM block exists — no whitelist is consulted, so the verdict
   * needs its own honest source label.
   */
  source: "cam" | "legacy-clientEditable" | "legacy-pseo-scopes" | "legacy-agent" | "default-deny";
}

/** Optional resolved inputs the caller supplies (pure-resolver contract). */
export interface ContentAuthorityInputs {
  /** Parsed pseo autonomy states (autonomy.state.yaml entries). */
  pseoScopes?: AutonomyState[];
}

// ─── pseo projection (Q-1: conservative ceiling) ────────────────────────────

/** pseo approval-authority levels never confer CAM mutation rights above L2. */
export const PSEO_CAM_CEILING = 2;

function pseoEffectiveLevel(state: AutonomyState): number {
  return Math.min(CAM_LEVEL_ORDER[state.level], CAM_LEVEL_ORDER[state.ceiling], PSEO_CAM_CEILING);
}

// ─── glob helpers ────────────────────────────────────────────────────────────

function pathMatches(path: string, patterns: string[] | undefined): boolean {
  if (!patterns || patterns.length === 0) return true;
  return patterns.some((p) => picomatch.isMatch(path, p, { dot: true }));
}

/**
 * Q-2 rule: two glob lists overlap if any pattern pair intersects. Segment-wise
 * approximation — a pair counts as intersecting unless a concrete (non-glob)
 * segment provably differs at the same position.
 */
export function globsOverlap(a: string[], b: string[]): boolean {
  for (const pa of a) {
    for (const pb of b) {
      if (globPairIntersects(pa, pb)) return true;
    }
  }
  return false;
}

function globPairIntersects(a: string, b: string): boolean {
  const segsA = a.split("/");
  const segsB = b.split("/");
  const len = Math.max(segsA.length, segsB.length);
  for (let i = 0; i < len; i++) {
    const sa = segsA[i];
    const sb = segsB[i];
    if (sa === undefined || sb === undefined) {
      // One side ran out: the shorter side must end in ** to still intersect.
      const shorter = sa === undefined ? segsA : segsB;
      if (shorter[shorter.length - 1] !== "**") return false;
      continue;
    }
    if (sa === "**" || sb === "**") return true;
    if (sa === sb) continue;
    if (sa.includes("*") || sb.includes("*") || sa.includes("{") || sb.includes("{")) {
      // Glob on at least one side at a differing position — counts as
      // intersecting (conservative per Q-2).
      return true;
    }
    // Two differing concrete segments at the same position — disjoint.
    return false;
  }
  return true;
}

// ─── clientEditable projection ───────────────────────────────────────────────

/**
 * Derives the collection-key whitelist the `studio-gate-client` grants imply:
 * first path segment under `src/content/` per grant glob (DNA-22 keys).
 */
export function projectClientEditable(authority: CamAuthority): string[] {
  const out = new Set<string>();
  for (const grant of authority.grants) {
    if (grant.subject !== "studio-gate-client") continue;
    for (const p of grant.paths ?? []) {
      const m = /^src\/content\/([^/]+)\//.exec(p) ?? /^src\/content\/([^/]+)$/.exec(p);
      if (m) out.add(m[1]);
    }
  }
  return [...out].sort();
}

// ─── resolver ────────────────────────────────────────────────────────────────

interface GateEntry {
  id: string;
  require: CamGate["require"];
}

function resolveCamVerdict(
  authority: CamAuthority,
  query: ContentAuthorityQuery,
): ContentAuthorityVerdict {
  const subject = authority.subjects.find((s) => s.id === query.subject);
  if (!subject) {
    return { allowed: false, level: 0, gates: [], source: "default-deny" };
  }

  const matched: CamGrant[] = authority.grants.filter(
    (g) =>
      g.subject === query.subject &&
      g.fieldClasses.includes(query.fieldClass) &&
      pathMatches(query.path, g.paths),
  );

  if (matched.length === 0) {
    return { allowed: false, level: 0, gates: [], source: "default-deny" };
  }

  let effective = Math.min(
    ...matched.map((g) =>
      g.maxLevel ? CAM_LEVEL_ORDER[g.maxLevel] : CAM_LEVEL_ORDER[subject.defaultLevel],
    ),
  );

  // Gates: grant-referenced ids + gates whose whenFieldClass covers the query.
  const gates = new Map<string, GateEntry>();
  const gateById = new Map(authority.gates.map((g) => [g.id, g]));
  for (const grant of matched) {
    for (const id of grant.gates ?? []) {
      const g = gateById.get(id);
      if (g) gates.set(id, { id, require: g.require });
    }
  }
  for (const g of authority.gates) {
    const classes = Array.isArray(g.whenFieldClass) ? g.whenFieldClass : [g.whenFieldClass];
    if (classes.includes(query.fieldClass)) {
      gates.set(g.id, { id: g.id, require: g.require });
      if (g.ceiling) effective = Math.min(effective, CAM_LEVEL_ORDER[g.ceiling]);
    }
  }

  return {
    allowed: query.level <= effective,
    level: effective,
    gates: [...gates.values()],
    source: "cam",
  };
}

function resolveLegacyVerdict(
  manifest: SystemManifest,
  query: ContentAuthorityQuery,
  inputs?: ContentAuthorityInputs,
): ContentAuthorityVerdict {
  if (query.subject === "studio-gate-client") {
    const whitelist = manifest.clientEditable ?? [];
    const allowed = whitelist.some(
      (key) =>
        picomatch.isMatch(query.path, `src/content/${key}/**`, { dot: true }) ||
        picomatch.isMatch(query.path, `src/content/${key}`, { dot: true }),
    );
    return {
      allowed,
      level: allowed ? 2 : 0,
      gates: [],
      source: allowed ? "legacy-clientEditable" : "default-deny",
    };
  }

  if (query.subject === "pseo-generator") {
    const scopes = (inputs?.pseoScopes ?? []).filter(
      (s) =>
        s.scope.fieldClass === query.fieldClass &&
        (!query.locale || s.scope.locale === query.locale),
    );
    if (scopes.length === 0) {
      return { allowed: false, level: 0, gates: [], source: "default-deny" };
    }
    const effective = Math.max(...scopes.map(pseoEffectiveLevel));
    return {
      allowed: query.level <= effective,
      level: effective,
      gates: [],
      source: "legacy-pseo-scopes",
    };
  }

  // agent-session: agent-primary posture — allowed within the content tree
  // only, bounded by the selector/collection reach of the write path itself.
  const inContentTree = query.path === "src/content" || query.path.startsWith("src/content/");
  return {
    allowed: inContentTree,
    level: inContentTree ? 4 : 0,
    gates: [],
    source: inContentTree ? "legacy-agent" : "default-deny",
  };
}

/**
 * RFC-1259 core: answers subject×fieldClass×path×required-level queries.
 * CAM block present → CAM verdict; absent → legacy projections. Pure.
 */
export function resolveContentAuthority(
  manifest: SystemManifest,
  query: ContentAuthorityQuery,
  inputs?: ContentAuthorityInputs,
): ContentAuthorityVerdict {
  if (manifest.authority) {
    return resolveCamVerdict(manifest.authority, query);
  }
  return resolveLegacyVerdict(manifest, query, inputs);
}
