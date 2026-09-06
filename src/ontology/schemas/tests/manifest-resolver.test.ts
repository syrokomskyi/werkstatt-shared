import { describe, it, expect } from "vitest";
import { getSectionPropsSchema } from "../manifest-resolver.ts";

describe("getSectionPropsSchema", () => {
  it("is an async function", () => {
    expect(typeof getSectionPropsSchema).toBe("function");
  });

  it("returns null for unknown archetype", async () => {
    const result = await getSectionPropsSchema("nonexistent-archetype", "/nonexistent");
    expect(result).toBeNull();
  });
});
