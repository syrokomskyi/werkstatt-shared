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
