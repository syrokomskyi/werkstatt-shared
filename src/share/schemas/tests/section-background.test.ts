import { describe, it, expect } from "vitest";
import { sectionBackgroundSchema } from "../section-background.ts";

describe("sectionBackgroundSchema", () => {
  it("accepts color kind", () => {
    const result = sectionBackgroundSchema.safeParse({ kind: "color" });
    expect(result.success).toBe(true);
  });

  it("accepts image kind with imageName", () => {
    const result = sectionBackgroundSchema.safeParse({
      kind: "image",
      imageName: "hero-bg",
    });
    expect(result.success).toBe(true);
  });

  it("accepts transparent kind", () => {
    const result = sectionBackgroundSchema.safeParse({ kind: "transparent" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid kind", () => {
    expect(() => sectionBackgroundSchema.parse({ kind: "video" })).toThrow();
  });

  it("rejects image kind without imageName", () => {
    const result = sectionBackgroundSchema.safeParse({ kind: "image" });
    expect(result.success).toBe(false);
  });
});
