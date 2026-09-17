import { describe, it, expect } from "vitest";
import { horizontalAlignSchema } from "../horizontal-align.ts";

describe("horizontalAlignSchema", () => {
  it("accepts valid alignment values", () => {
    expect(horizontalAlignSchema.parse("left")).toBe("left");
    expect(horizontalAlignSchema.parse("center")).toBe("center");
    expect(horizontalAlignSchema.parse("right")).toBe("right");
  });

  it("rejects invalid alignment values", () => {
    expect(() => horizontalAlignSchema.parse("top")).toThrow();
    expect(() => horizontalAlignSchema.parse("")).toThrow();
    expect(() => horizontalAlignSchema.parse(null)).toThrow();
  });
});
