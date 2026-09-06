import { describe, it, expect } from "vitest";
import { systemIntegrationsSchema } from "../integrations.ts";

describe("systemIntegrationsSchema", () => {
  it("is defined", () => {
    expect(systemIntegrationsSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => systemIntegrationsSchema.parse(null)).toThrow();
  });
});
