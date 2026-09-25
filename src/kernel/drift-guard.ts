/*
<MODULE_CONTRACT>
<purpose>
RFC-1126: pre-overwrite drift guard. Generators that rewrite git-tracked files
call guardTrackedOverwrite before writing; when the on-disk content carries
manual edits that the new content would destroy, the guard warns (default) or
throws (--strict) listing the exact keys/sections that would be lost.
</purpose>
<non-goals>
  <item>Does not perform the write itself — callers write via context.io / writeFileIfChanged after the guard returns.</item>
  <item>Does not decide marker-protocol skips — callers run hasGeneratedMarker checks first; the guard only sees files about to be written.</item>
  <item>Does not guard non-tracked files — the caller decides which paths are git-tracked generated outputs.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>Warn-by-default; --strict is the sole fail-hard opt-in — --force keeps DNA-93 cache-clearing semantics.</item>
  <item>The guard is a pre-write side effect, never a cached result — command-result caching (RFC-0390) must not cache it.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1126: initial implementation — DriftReport, DriftGuardOptions, guardTrackedOverwrite with json/yaml/text key extraction.</item>
  <item>RFC-1126: step 1 — shared contracts (drift guard + workpiece env)

Add guardTrackedOverwrite (json/yaml/text lost-key diff, warn-by-default, --strict fail-hard) and loadWorkpieceEnv (dotenv.parse wrapper) to werkstatt-shared kernel subpath; extend KernelRuntimeContext with optional workpieceEnv field.</item>
</CHANGE_SUMMARY>
*/

import { parse as yamlParse } from "yaml";
import { createDefaultIO, type WorkspaceIO } from "@warpgogol/werkstatt-shared/kernel/workspace-io";

export interface DriftReport {
  file: string;
  /** Keys/sections present on disk but absent or changed in the new content (dotted paths). */
  wouldLose: string[];
  /** True when on-disk content already equals new content — caller may skip the write. */
  identical: boolean;
}

export interface DriftGuardOptions {
  format: "json" | "yaml" | "text";
  /** Fail-hard instead of warning. */
  strict?: boolean;
  /** Remediation hint appended to the warning/error message. */
  fixHint?: string;
}

export interface DriftGuardLogger {
  warn(msg: string): void;
}

const MAX_REPORTED_KEYS = 20;

/** Collect dotted paths present in `oldValue` but absent or changed in `newValue`. */
function collectLostKeys(
  oldValue: unknown,
  newValue: unknown,
  prefix: string,
  out: string[],
): void {
  if (out.length >= MAX_REPORTED_KEYS) return;
  if (oldValue === null || typeof oldValue !== "object") {
    if (oldValue !== newValue) out.push(prefix);
    return;
  }
  if (Array.isArray(oldValue)) {
    if (!Array.isArray(newValue)) {
      out.push(prefix);
      return;
    }
    for (let i = 0; i < oldValue.length; i++) {
      if (i >= newValue.length) {
        out.push(`${prefix}[${i}]`);
      } else {
        collectLostKeys(oldValue[i], newValue[i], `${prefix}[${i}]`, out);
      }
      if (out.length >= MAX_REPORTED_KEYS) return;
    }
    return;
  }
  const oldObj = oldValue as Record<string, unknown>;
  const newObj =
    newValue !== null && typeof newValue === "object" && !Array.isArray(newValue)
      ? (newValue as Record<string, unknown>)
      : {};
  for (const key of Object.keys(oldObj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!(key in newObj)) {
      out.push(path);
    } else {
      collectLostKeys(oldObj[key], newObj[key], path, out);
    }
    if (out.length >= MAX_REPORTED_KEYS) return;
  }
}

function diffStructured(format: "json" | "yaml", existing: string, next: string): string[] {
  try {
    const oldValue: unknown = format === "json" ? JSON.parse(existing) : yamlParse(existing);
    const newValue: unknown = format === "json" ? JSON.parse(next) : yamlParse(next);
    const out: string[] = [];
    collectLostKeys(oldValue, newValue, "", out);
    return out;
  } catch {
    // Unparseable existing content — fall back to line diff so drift is still visible.
    return diffText(existing, next);
  }
}

function diffText(existing: string, next: string): string[] {
  const nextLines = new Set(next.split("\n").map((l) => l.trim()));
  const lost: string[] = [];
  for (const line of existing.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !nextLines.has(trimmed)) {
      lost.push(trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed);
      if (lost.length >= MAX_REPORTED_KEYS) break;
    }
  }
  return lost;
}

/**
 * Compare newContent against the on-disk file before overwriting. Returns a
 * DriftReport; warns via logger (or throws when options.strict) listing the
 * keys that would be destroyed. Never throws for a missing file — nothing to
 * lose. Callers should skip the write entirely when report.identical is true.
 */
export async function guardTrackedOverwrite(
  filePath: string,
  newContent: string,
  options: DriftGuardOptions,
  logger: DriftGuardLogger, io: WorkspaceIO = createDefaultIO().io,
): Promise<DriftReport> {
  let existing: string | null = null;
  try {
    existing = await io.readFile(filePath);
  } catch {
    // File absent — nothing to lose.
  }

  if (existing === null) {
    return { file: filePath, wouldLose: [], identical: false };
  }
  if (existing === newContent) {
    return { file: filePath, wouldLose: [], identical: true };
  }

  const wouldLose =
    options.format === "text"
      ? diffText(existing, newContent)
      : diffStructured(options.format, existing, newContent);

  if (wouldLose.length === 0) {
    return { file: filePath, wouldLose, identical: false };
  }

  const hint = options.fixHint ? ` ${options.fixHint}` : "";
  const message =
    `DRIFT-GUARD-01: ${filePath} — manual edits would be destroyed: ` +
    `${wouldLose.join(", ")}.${hint}`;

  if (options.strict) {
    throw new Error(message);
  }
  logger.warn(message);
  return { file: filePath, wouldLose, identical: false };
}
