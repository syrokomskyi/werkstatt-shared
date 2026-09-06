import { describe, it, expect } from "vitest";
import { resolveActiveCapabilities, capabilityToActionRef } from "../capability.ts";

describe("resolveActiveCapabilities", () => {
  it("is a function", () => {
    expect(typeof resolveActiveCapabilities).toBe("function");
  });
});

describe("capabilityToActionRef", () => {
  it("is a function", () => {
    expect(typeof capabilityToActionRef).toBe("function");
  });
});
