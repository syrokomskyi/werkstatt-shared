/*
<MODULE_CONTRACT>
<purpose>
RFC-1078: Pure freshness calculation functions for semantic.freshness.validate.
Provides calculateAgeDays, isAssessmentStale, isItemStale, and the FreshnessViolation
interface. All functions are pure and deterministic for a fixed reference date.
</purpose>
<non-goals>
  <item>Does not compile PBP profiles — that is the validator's job in werkstatt-site.</item>
  <item>Does not emit diagnostics — the validator collects violations and emits them.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1078: initial — calculateAgeDays, isAssessmentStale, isItemStale, FreshnessViolation, DEFAULT_FRESHNESS_WINDOW_DAYS.</item>
</CHANGE_SUMMARY>
*/

/** RFC-1078: Default freshness window for evidence items without a declared maxAgeDays. */
export const DEFAULT_FRESHNESS_WINDOW_DAYS = 180;

/** RFC-1078: A freshness violation detected by semantic.freshness.validate. */
export interface FreshnessViolation {
  rule: string;
  entityType: string;
  entityId: string;
  /** The field that is stale: assessment.observedAt, items[].retrievedAt, etc. */
  field: string;
  /** The observed timestamp. */
  observedAt: string;
  /** The maximum age in days. */
  maxAgeDays: number;
  /** The actual age in days at validation time. */
  actualAgeDays: number;
  message: string;
}

/**
 * RFC-1078: Calculate age in days from an ISO timestamp to a reference date.
 * Pure and deterministic for a fixed reference date.
 * Returns Number.MAX_SAFE_INTEGER for invalid date strings.
 */
export function calculateAgeDays(observedAt: string, referenceDate: Date = new Date()): number {
  const observed = new Date(observedAt);
  if (isNaN(observed.getTime())) return Number.MAX_SAFE_INTEGER;
  const diffMs = referenceDate.getTime() - observed.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/** RFC-1078: Check if a technical assessment is stale. Pure. */
export function isAssessmentStale(
  assessment: { observedAt: string; freshness: { maxAgeDays: number } },
  referenceDate: Date = new Date(),
): boolean {
  const ageDays = calculateAgeDays(assessment.observedAt, referenceDate);
  return ageDays > assessment.freshness.maxAgeDays;
}

/** RFC-1078: Check if an evidence item is stale. Pure. Returns false if retrievedAt is missing. */
export function isItemStale(
  item: { retrievedAt?: string },
  maxAgeDays: number,
  referenceDate: Date = new Date(),
): boolean {
  if (!item.retrievedAt) return false;
  const ageDays = calculateAgeDays(item.retrievedAt, referenceDate);
  return ageDays > maxAgeDays;
}
