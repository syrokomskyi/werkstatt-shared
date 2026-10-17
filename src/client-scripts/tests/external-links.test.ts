/*
<MODULE_CONTRACT>
<purpose>
Unit tests for external links covering applyExternalLinkBehavior. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the external suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

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
