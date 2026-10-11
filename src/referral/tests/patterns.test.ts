import { describe, it, expect } from "vitest";
import {
  REF_PARAM_PATTERN,
  SCENARIO_PARAM_PATTERN,
  TARGET_QUERY_KEY_PATTERN,
  TARGET_QUERY_VALUE_PATTERN,
} from "../patterns.ts";

// RFC-1257: the scenario param and the CtaTarget query-map bounds live here —
// the client preselect, the API edge normalization, and the props schemas all
// share these patterns, so the charset contract is tested once, canonically.
describe("SCENARIO_PARAM_PATTERN (RFC-1257)", () => {
  it("accepts lowercase kebab ids", () => {
    for (const v of ["bestand", "neu", "notfall-24", "x", "a1-b2"]) {
      expect(SCENARIO_PARAM_PATTERN.test(v)).toBe(true);
    }
  });

  it("rejects malformed values the API edge must drop", () => {
    for (const v of ["", "Bestand", "bestand!", "with space", "ünïcode", "a".repeat(33)]) {
      expect(SCENARIO_PARAM_PATTERN.test(v)).toBe(false);
    }
  });
});

describe("REF_PARAM_PATTERN", () => {
  it("keeps its 3..32 lower-kebab bound (unchanged contract)", () => {
    expect(REF_PARAM_PATTERN.test("ost-post")).toBe(true);
    expect(REF_PARAM_PATTERN.test("ab")).toBe(false);
    expect(REF_PARAM_PATTERN.test("a".repeat(33))).toBe(false);
  });
});

describe("TARGET_QUERY_*_PATTERN (RFC-1257)", () => {
  it("keys are 1..32 of [a-zA-Z0-9_-]", () => {
    expect(TARGET_QUERY_KEY_PATTERN.test("scenario")).toBe(true);
    expect(TARGET_QUERY_KEY_PATTERN.test("utm_source")).toBe(true);
    expect(TARGET_QUERY_KEY_PATTERN.test("Ref-1")).toBe(true);
    expect(TARGET_QUERY_KEY_PATTERN.test("")).toBe(false);
    expect(TARGET_QUERY_KEY_PATTERN.test("a".repeat(33))).toBe(false);
    expect(TARGET_QUERY_KEY_PATTERN.test("bad key")).toBe(false);
    expect(TARGET_QUERY_KEY_PATTERN.test("k=v")).toBe(false);
  });

  it("values are 0..128 of [a-zA-Z0-9_%.-]", () => {
    expect(TARGET_QUERY_VALUE_PATTERN.test("")).toBe(true);
    expect(TARGET_QUERY_VALUE_PATTERN.test("ost-post")).toBe(true);
    expect(TARGET_QUERY_VALUE_PATTERN.test("20%off")).toBe(true);
    expect(TARGET_QUERY_VALUE_PATTERN.test("v".repeat(129))).toBe(false);
    expect(TARGET_QUERY_VALUE_PATTERN.test("has space")).toBe(false);
    expect(TARGET_QUERY_VALUE_PATTERN.test("a&b")).toBe(false);
  });
});
