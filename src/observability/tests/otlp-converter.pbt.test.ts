/*
<MODULE_CONTRACT>
<purpose>
Unit tests for otlp converter.pbt covering convertAccumulatedToOtlp — property-based tests (DNA-41).
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the otlp suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { convertAccumulatedToOtlp, type AccumulatedPoint } from "../otlp-converter.ts";

const START_TIME = "1751884500000000000";

const metricNameArb = fc.constantFrom(
  "warpgogol_factory_smoke_total",
  "warpgogol_factory_command_runs_total",
  "warpgogol_probe_up",
  "warpgogol_probe_ttfb_seconds",
  "warpgogol_factory_command_duration_seconds",
);

const kindArb = fc.constantFrom<"counter" | "gauge" | "histogram">("counter", "gauge", "histogram");

const pointArb: fc.Arbitrary<AccumulatedPoint> = fc.record({
  name: metricNameArb,
  labels: fc.dictionary(fc.string({ maxLength: 10 }), fc.string({ maxLength: 20 })),
  value: fc.double({ min: 0, max: 1000, noDefaultInfinity: true, noNaN: true }),
  kind: kindArb,
});

const pointsArb = fc.array(pointArb, { maxLength: 50 });

describe("convertAccumulatedToOtlp — property-based tests (DNA-41)", () => {
  it("bucket counts sum equals total points per histogram metric", () => {
    fc.assert(
      fc.property(pointsArb, (points) => {
        const result = convertAccumulatedToOtlp(points, START_TIME);
        for (const otlp of result) {
          if (otlp.kind === "histogram" && otlp.histogramPoints) {
            const hp = otlp.histogramPoints[0]!;
            const bucketSum = hp.bucketCounts.reduce((acc, c) => acc + Number(c), 0);
            const histogramPoints = points.filter((p) => p.name === otlp.name);
            expect(bucketSum).toBe(histogramPoints.length);
            expect(hp.count).toBe(String(histogramPoints.length));
          }
        }
      }),
    );
  });

  it("output metric names are a subset of input metric names", () => {
    fc.assert(
      fc.property(pointsArb, (points) => {
        const result = convertAccumulatedToOtlp(points, START_TIME);
        const inputNames = new Set(points.map((p) => p.name));
        for (const otlp of result) {
          expect(inputNames.has(otlp.name)).toBe(true);
        }
      }),
    );
  });

  it("each output metric appears exactly once (grouping is stable)", () => {
    fc.assert(
      fc.property(pointsArb, (points) => {
        const result = convertAccumulatedToOtlp(points, START_TIME);
        const outputNames = result.map((r) => r.name);
        const uniqueNames = new Set(outputNames);
        expect(outputNames.length).toBe(uniqueNames.size);
      }),
    );
  });

  it("empty input always produces empty output", () => {
    fc.assert(
      fc.property(pointsArb, (points) => {
        if (points.length === 0) {
          const result = convertAccumulatedToOtlp(points, START_TIME);
          expect(result).toEqual([]);
        }
      }),
    );
  });
});
