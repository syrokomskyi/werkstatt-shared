import { describe, it, expect } from "vitest";
import { siteBackgroundLayerSchema } from "../site-background.ts";

describe("siteBackgroundLayerSchema", () => {
  it("accepts color kind", () => {
    const result = siteBackgroundLayerSchema.safeParse({ kind: "color" });
    expect(result.success).toBe(true);
  });

  it("accepts image kind with imageName", () => {
    const result = siteBackgroundLayerSchema.safeParse({
      kind: "image",
      imageName: "bg",
    });
    expect(result.success).toBe(true);
  });

  it("accepts gradient kind with required fields", () => {
    const result = siteBackgroundLayerSchema.safeParse({
      kind: "gradient",
      direction: "vertical",
      stops: [
        { at: 0, color: "#000" },
        { at: 1, color: "#fff" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid kind", () => {
    expect(() => siteBackgroundLayerSchema.parse({ kind: "video" })).toThrow();
  });
});
