/*
<MODULE_CONTRACT>
<purpose>RFC-0213: tests for the freshness state model + ISO duration arithmetic.</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0213: initial freshness tests.</item>
</CHANGE_SUMMARY>
*/

import { test, expect } from "vitest";
import { addDuration, evaluateFreshness } from "../freshness.ts";

test("addDuration: months and years are calendar-correct", () => {
  expect(addDuration("2026-01-15", "P1Y")).toBe("2027-01-15");
  expect(addDuration("2026-06-01", "P3M")).toBe("2026-09-01");
  expect(addDuration("2026-06-20", "P2W")).toBe("2026-07-04");
  expect(addDuration("2026-12-20", "P1M")).toBe("2027-01-20");
});

test("addDuration: rejects malformed / empty durations", () => {
  expect(addDuration("2026-06-20", "P")).toBe(null);
  expect(addDuration("2026-06-20", "PT")).toBe(null);
  expect(addDuration("not-a-date", "P1Y")).toBe(null);
});

test("evaluateFreshness: fresh when no window pressure", () => {
  const e = evaluateFreshness({ asOf: "2026-06-01", validUntil: "2027-06-01" }, "2026-06-20");
  expect(e.state).toBe("fresh");
  expect(e.daysToExpiry! > 300).toBe(true);
});

test("evaluateFreshness: expiring-soon within the window", () => {
  const e = evaluateFreshness({ asOf: "2026-01-01", validUntil: "2026-07-10" }, "2026-06-20", 30);
  expect(e.state).toBe("expiring-soon");
});

test("evaluateFreshness: expired past validUntil", () => {
  const e = evaluateFreshness({ asOf: "2025-01-01", validUntil: "2026-06-01" }, "2026-06-20");
  expect(e.state).toBe("expired");
  expect(e.daysToExpiry! < 0).toBe(true);
});

test("evaluateFreshness: review-due when cadence lapsed and no expiry pressure", () => {
  const e = evaluateFreshness({ asOf: "2025-01-01", reviewEvery: "P1Y" }, "2026-06-20");
  expect(e.state).toBe("review-due");
  expect(e.reviewDueAt).toBe("2026-01-01");
});

test("evaluateFreshness: expiry takes precedence over review-due", () => {
  const e = evaluateFreshness(
    { asOf: "2025-01-01", validUntil: "2026-06-01", reviewEvery: "P1M" },
    "2026-06-20",
  );
  expect(e.state).toBe("expired");
});

test("evaluateFreshness: no validUntil and no reviewEvery is always fresh", () => {
  const e = evaluateFreshness({ asOf: "2020-01-01" }, "2026-06-20");
  expect(e.state).toBe("fresh");
});
