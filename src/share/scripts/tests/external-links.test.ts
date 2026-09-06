import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { applyExternalLinkBehavior } from "../external-links.ts";

describe("applyExternalLinkBehavior", () => {
  beforeEach(() => {
    vi.stubGlobal("document", {
      querySelectorAll: vi.fn(() => []),
    });
    vi.stubGlobal("window", {
      location: { href: "https://example.com/", origin: "https://example.com" },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is a function", () => {
    expect(typeof applyExternalLinkBehavior).toBe("function");
  });

  it("does not throw when no anchors exist", () => {
    expect(() => applyExternalLinkBehavior()).not.toThrow();
  });
});
