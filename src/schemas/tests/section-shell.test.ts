/*
<MODULE_CONTRACT>
<purpose>
Unit tests for section shell covering sectionDensitySchema; sectionToneSchema; sectionContainerVariantSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the section suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import {
  sectionDensitySchema,
  sectionToneSchema,
  sectionContainerVariantSchema,
  sectionShellAnimatedSchema,
} from "../section-shell.ts";

describe("sectionDensitySchema", () => {
  it("accepts valid densities", () => {
    for (const d of ["compact", "normal", "spacious", "flush"]) {
      expect(sectionDensitySchema.parse(d)).toBe(d);
    }
  });

  it("rejects invalid density", () => {
    expect(() => sectionDensitySchema.parse("loose")).toThrow();
  });
});

describe("sectionToneSchema", () => {
  it("accepts valid tones", () => {
    for (const t of ["default", "warning", "success", "muted"]) {
      expect(sectionToneSchema.parse(t)).toBe(t);
    }
  });
});

describe("sectionContainerVariantSchema", () => {
  it("accepts valid variants", () => {
    for (const v of ["default", "narrow", "full"]) {
      expect(sectionContainerVariantSchema.parse(v)).toBe(v);
    }
  });
});

describe("sectionShellAnimatedSchema", () => {
  it("accepts valid values", () => {
    expect(sectionShellAnimatedSchema.parse("none")).toBe("none");
    expect(sectionShellAnimatedSchema.parse("reveal")).toBe("reveal");
  });
});
