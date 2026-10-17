/*
<MODULE_CONTRACT>
<purpose>
Unit tests for freshnesspbt — freshness.pbt covering calculateAgeDays — property-based (AC-7); isAssessmentStale; isItemStale.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the freshness.pbt suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  calculateAgeDays,
  isAssessmentStale,
  isItemStale,
  DEFAULT_FRESHNESS_WINDOW_DAYS,
} from "../freshness.ts";

const validTimestamp = fc.integer({ min: 0, max: Date.now() });
const validDateFromTs = (ts: number) => new Date(ts);

describe("calculateAgeDays — property-based (AC-7)", () => {
  it("is pure and deterministic — same input always produces same output", () => {
    fc.assert(
      fc.property(validTimestamp, validTimestamp, (observedTs, referenceTs) => {
        const observed = validDateFromTs(observedTs);
        const reference = validDateFromTs(referenceTs);
        const a = calculateAgeDays(observed.toISOString(), reference);
        const b = calculateAgeDays(observed.toISOString(), reference);
        expect(a).toBe(b);
      }),
      { numRuns: 50 },
    );
  });

  it("returns non-negative age when reference >= observed", () => {
    fc.assert(
      fc.property(
        validTimestamp,
        fc.integer({ min: 0, max: 365 * 10 }),
        (observedTs, daysAfter) => {
          const observed = validDateFromTs(observedTs);
          const reference = new Date(observed.getTime() + daysAfter * 86400000);
          const age = calculateAgeDays(observed.toISOString(), reference);
          expect(age).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("returns negative age when reference < observed", () => {
    fc.assert(
      fc.property(
        validTimestamp.filter((ts) => ts > 365 * 10 * 86400000),
        fc.integer({ min: 1, max: 365 * 10 }),
        (observedTs, daysBefore) => {
          const observed = validDateFromTs(observedTs);
          const reference = new Date(observed.getTime() - daysBefore * 86400000);
          const age = calculateAgeDays(observed.toISOString(), reference);
          expect(age).toBeLessThan(0);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("returns Number.MAX_SAFE_INTEGER for invalid date strings", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => isNaN(new Date(s).getTime())),
        (invalid) => {
          expect(calculateAgeDays(invalid)).toBe(Number.MAX_SAFE_INTEGER);
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe("isAssessmentStale", () => {
  it("returns true when age exceeds maxAgeDays", () => {
    const reference = new Date("2026-09-12T00:00:00Z");
    const assessment = {
      observedAt: "2026-06-01T00:00:00Z",
      freshness: { maxAgeDays: 90 },
    };
    expect(isAssessmentStale(assessment, reference)).toBe(true);
  });

  it("returns false when age is within maxAgeDays", () => {
    const reference = new Date("2026-09-12T00:00:00Z");
    const assessment = {
      observedAt: "2026-08-01T00:00:00Z",
      freshness: { maxAgeDays: 90 },
    };
    expect(isAssessmentStale(assessment, reference)).toBe(false);
  });
});

describe("isItemStale", () => {
  it("returns false when retrievedAt is missing", () => {
    expect(isItemStale({}, DEFAULT_FRESHNESS_WINDOW_DAYS)).toBe(false);
  });

  it("returns true when age exceeds maxAgeDays", () => {
    const reference = new Date("2026-09-12T00:00:00Z");
    const item = { retrievedAt: "2026-01-01T00:00:00Z" };
    expect(isItemStale(item, 180, reference)).toBe(true);
  });

  it("returns false when age is within maxAgeDays", () => {
    const reference = new Date("2026-09-12T00:00:00Z");
    const item = { retrievedAt: "2026-08-01T00:00:00Z" };
    expect(isItemStale(item, 180, reference)).toBe(false);
  });
});
