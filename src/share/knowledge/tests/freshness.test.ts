import { describe, it, expect } from "vitest";
import { addDuration } from "../freshness.ts";

describe("addDuration", () => {
  it("is a function", () => {
    expect(typeof addDuration).toBe("function");
  });

  it("adds months to a date", () => {
    const result = addDuration("2026-01-01", "P3M");
    expect(result).not.toBeNull();
  });

  it("returns null for invalid duration", () => {
    const result = addDuration("2026-01-01", "invalid");
    expect(result).toBeNull();
  });
});
