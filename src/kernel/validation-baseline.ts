/*
<MODULE_CONTRACT>
<purpose>
RFC-1316: blocking-validator debt baseline — schema, loader, partition helper,
and canonical digest functions. `docs/validation-baseline.generated.yaml`
records the current violation set of `baselineEligible` commands so delta-mode
gates fail only on violations absent from the recorded set. Canonical
`maintenanceDebtKey`/`normalizeMaintenanceDebtMessage` live here (rehomed from
werkstatt-site checks/ecosystem/debt.ts) — engine validators cannot reach site
code (site → engine+shared, engine → shared).
</purpose>
<non-goals>
  <item>Do not run validators or write the baseline — that is the validation.baseline.update command's job in werkstatt-site.</item>
  <item>Do not absorb the RFC-0251 advisory maintenance baseline — that ledger is human-acknowledged (owner/rationale), this file is machine-ratcheted.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1316: initial module — ValidationBaseline zod schema, loader, render/serialize, partitionByBaseline, validationBaselineKey; maintenanceDebtKey/normalizeMaintenanceDebtMessage rehomed from site debt.ts.</item>
</CHANGE_SUMMARY>
*/

import { join } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { z } from "zod";
import { byteHash } from "../fingerprint/primitives.ts";

export const VALIDATION_BASELINE_PATH = join("docs", "validation-baseline.generated.yaml");

const HASH_PREFIX = "sha" + "256:";

export function digestHex(value: string): string {
  return byteHash(value).slice(HASH_PREFIX.length);
}

// ---------------------------------------------------------------------------
// Canonical maintenance-debt digest helpers (rehomed from werkstatt-site
// checks/ecosystem/debt.ts — the RFC-0251 advisory ledger keeps its key shape;
// this module is the single implementation both ledgers share).
// ---------------------------------------------------------------------------

export function normalizeMaintenanceDebtMessage(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export interface MaintenanceDebtKeyable {
  sourceCommand: string;
  app?: string;
  ruleId?: string;
  file?: string;
  line?: number;
  message: string;
}

export function maintenanceDebtKey(item: MaintenanceDebtKeyable): string {
  return digestHex(
    JSON.stringify({
      sourceCommand: item.sourceCommand,
      app: item.app ?? "",
      ruleId: item.ruleId ?? "",
      file: item.file ?? "",
      line: item.line ?? null,
      message: normalizeMaintenanceDebtMessage(item.message),
    }),
  );
}

// ---------------------------------------------------------------------------
// Validation baseline (RFC-1316) — machine-ratcheted blocking-debt ledger.
// Key = sha256 of {ruleId, file, normalizedMessage}; line is advisory-only so
// drift under edits never mints a fresh violation.
// ---------------------------------------------------------------------------

export const validationBaselineViolationSchema = z.object({
  key: z.string(),
  ruleId: z.string(),
  file: z.string(),
  line: z.number().optional(),
  message: z.string(),
});

export const validationBaselineSchema = z.object({
  meta: z.object({
    schemaVersion: z.literal(1),
    deterministic: z.literal(true),
    generatedAt: z.null(),
    contentHash: z.string(),
    growthAllowed: z.boolean().optional(),
  }),
  commands: z.record(
    z.string(),
    z.object({ violations: z.array(validationBaselineViolationSchema) }),
  ),
});

export type ValidationBaselineViolation = z.infer<typeof validationBaselineViolationSchema>;
export type ValidationBaseline = z.infer<typeof validationBaselineSchema>;

export interface ValidationBaselineKeyable {
  ruleId: string;
  file?: string;
  line?: number;
  message: string;
}

export function validationBaselineKey(item: ValidationBaselineKeyable): string {
  return digestHex(
    JSON.stringify({
      ruleId: item.ruleId,
      file: item.file ?? "",
      message: normalizeMaintenanceDebtMessage(item.message),
    }),
  );
}

export function validationBaselineEntry(
  item: ValidationBaselineKeyable,
): ValidationBaselineViolation {
  return {
    key: validationBaselineKey(item),
    ruleId: item.ruleId,
    file: item.file ?? "",
    ...(typeof item.line === "number" ? { line: item.line } : {}),
    message: normalizeMaintenanceDebtMessage(item.message),
  };
}

/**
 * Deterministic render: violations sorted by key, commands sorted by name,
 * contentHash = sha256 over the document with the hash field blanked.
 */
export function renderValidationBaseline(
  commands: Record<string, { violations: ValidationBaselineViolation[] }>,
  options: { growthAllowed?: boolean } = {},
): string {
  const sorted: Record<string, { violations: ValidationBaselineViolation[] }> = {};
  for (const name of Object.keys(commands).sort()) {
    sorted[name] = {
      violations: [...commands[name]!.violations].sort((a, b) => a.key.localeCompare(b.key)),
    };
  }
  const withoutHash = {
    meta: {
      schemaVersion: 1 as const,
      deterministic: true as const,
      generatedAt: null,
      contentHash: "",
      ...(options.growthAllowed ? { growthAllowed: true } : {}),
    },
    commands: sorted,
  };
  const baseline: ValidationBaseline = {
    ...withoutHash,
    meta: {
      ...withoutHash.meta,
      contentHash: digestHex(JSON.stringify(withoutHash)),
    },
  };
  return yamlStringify(baseline);
}

export async function loadValidationBaseline(
  workspaceRoot: string,
  io: { readFile(path: string): Promise<string> },
): Promise<ValidationBaseline | undefined> {
  let raw: string;
  try {
    raw = await io.readFile(join(workspaceRoot, VALIDATION_BASELINE_PATH));
  } catch {
    return undefined;
  }
  const parsed = validationBaselineSchema.safeParse(yamlParse(raw));
  return parsed.success ? parsed.data : undefined;
}

/**
 * Partition a validator's diagnostics into fresh (not baseline-listed → still
 * blocking) and debt (baseline-listed → downgraded to info by the caller).
 * Missing/invalid baseline yields the empty set for `commands[command]` —
 * callers treat an absent baseline as full-debt mode where everything fails,
 * so they MUST pass `undefined` only when the file is genuinely missing and
 * keep diagnostics blocking; partitioning happens only against a parsed set.
 */
export function partitionByBaseline<T extends ValidationBaselineKeyable>(
  command: string,
  items: T[],
  baseline: ValidationBaseline,
): { fresh: T[]; debt: T[] } {
  const recorded = new Set((baseline.commands[command]?.violations ?? []).map((v) => v.key));
  const fresh: T[] = [];
  const debt: T[] = [];
  for (const item of items) {
    (recorded.has(validationBaselineKey(item)) ? debt : fresh).push(item);
  }
  return { fresh, debt };
}
