import { describe, it, expect } from "vitest";
import { componentOverridesSchema } from "../page-base.ts";

describe("componentOverridesSchema", () => {
  it("accepts undefined (optional)", () => {
    expect(componentOverridesSchema.parse(undefined)).toBeUndefined();
  });

  it("accepts empty record", () => {
    expect(componentOverridesSchema.parse({})).toEqual({});
  });

  it("accepts a valid overrides map", () => {
    const overrides = {
      "components/Header": { title: "Custom" },
    };
    expect(componentOverridesSchema.parse(overrides)).toEqual(overrides);
  });
});
