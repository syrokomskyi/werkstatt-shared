/*
<MODULE_CONTRACT>
<purpose>
Unit tests for print covering print constants. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the print suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import {
  PRINT_ORIENTATIONS,
  PRINT_PAGE_SIZES,
  PRINT_MARGINS,
  PRINT_BACKGROUND_MODES,
  PRINT_REGIONS,
} from "../print.ts";

describe("print constants", () => {
  it("PRINT_ORIENTATIONS has expected values", () => {
    expect(PRINT_ORIENTATIONS).toEqual(["portrait", "landscape", "auto"]);
  });

  it("PRINT_PAGE_SIZES has expected values", () => {
    expect(PRINT_PAGE_SIZES).toEqual(["a4", "letter", "legal"]);
  });

  it("PRINT_MARGINS has expected values", () => {
    expect(PRINT_MARGINS).toEqual(["normal", "narrow", "none"]);
  });

  it("PRINT_BACKGROUND_MODES has expected values", () => {
    expect(PRINT_BACKGROUND_MODES).toEqual(["preserve", "flatten"]);
  });

  it("PRINT_REGIONS is a non-empty array", () => {
    expect(PRINT_REGIONS.length).toBeGreaterThan(0);
  });
});
