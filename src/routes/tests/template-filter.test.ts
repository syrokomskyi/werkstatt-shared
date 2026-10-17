/*
<MODULE_CONTRACT>
<purpose>
Unit tests for template filter covering hasPlaceholderRoutes. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the template suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { hasPlaceholderRoutes } from "../template-filter.ts";

describe("hasPlaceholderRoutes", () => {
  it("returns true for routes containing [slug]", () => {
    expect(hasPlaceholderRoutes({ de: "nachweis/[slug]" })).toBe(true);
  });

  it("returns true for routes containing [version]", () => {
    expect(hasPlaceholderRoutes({ de: "verify/[version]" })).toBe(true);
  });

  it("returns true for routes containing [...path] (rest params)", () => {
    expect(hasPlaceholderRoutes({ de: "docs/[...path]" })).toBe(true);
  });

  it("returns true for mixed routes (some plain, some placeholder)", () => {
    expect(hasPlaceholderRoutes({ de: "home", en: "blog/[slug]" })).toBe(true);
  });

  it("returns false for plain routes without brackets", () => {
    expect(hasPlaceholderRoutes({ de: "home", en: "about" })).toBe(false);
  });

  it("returns false for undefined routes", () => {
    expect(hasPlaceholderRoutes(undefined)).toBe(false);
  });

  it("returns false for null routes", () => {
    expect(hasPlaceholderRoutes(null)).toBe(false);
  });

  it("returns false for empty routes object", () => {
    expect(hasPlaceholderRoutes({})).toBe(false);
  });

  it("returns false when route values are non-string", () => {
    expect(hasPlaceholderRoutes({ de: 123 as unknown as string })).toBe(false);
  });
});
