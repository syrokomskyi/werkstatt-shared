import { describe, it, expect } from "vitest";
import { AGENT_SURFACE_VERSION } from "../manifest.ts";

describe("AGENT_SURFACE_VERSION", () => {
  it("is a version string", () => {
    expect(typeof AGENT_SURFACE_VERSION).toBe("string");
    expect(AGENT_SURFACE_VERSION).toMatch(/\d+\.\d+\.\d+/);
  });
});
