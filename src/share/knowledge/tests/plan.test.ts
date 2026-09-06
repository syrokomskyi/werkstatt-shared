import { describe, it, expect } from "vitest";
import { stableTaskId } from "../plan.ts";

describe("stableTaskId", () => {
  it("is a function", () => {
    expect(typeof stableTaskId).toBe("function");
  });

  it("returns a string id", () => {
    const result = stableTaskId("subject-1", "review-due");
    expect(typeof result).toBe("string");
  });

  it("is deterministic for same inputs", () => {
    const a = stableTaskId("subject-1", "review-due");
    const b = stableTaskId("subject-1", "review-due");
    expect(a).toBe(b);
  });
});
