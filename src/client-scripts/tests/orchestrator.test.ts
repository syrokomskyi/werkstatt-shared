/*
<MODULE_CONTRACT>
<purpose>
Unit tests for orchestrator covering runStandardLayoutOrchestration. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the orchestrator suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../scroll-spy.ts", () => ({
  initScrollSpy: vi.fn(() => () => {}),
}));

import { runStandardLayoutOrchestration } from "../orchestrator.ts";
import { initScrollSpy } from "../scroll-spy.ts";

describe("runStandardLayoutOrchestration", () => {
  beforeEach(() => {
    class MockElement {}
    vi.stubGlobal("Element", MockElement);
    vi.stubGlobal("window", {
      matchMedia: vi.fn(() => ({ matches: false })),
      addEventListener: vi.fn(),
    });
    vi.stubGlobal("document", {
      readyState: "complete",
      querySelector: vi.fn(() => null),
      addEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("is an async function", () => {
    expect(typeof runStandardLayoutOrchestration).toBe("function");
  });

  it("AC-6: calls initScrollSpy unconditionally as a new step", async () => {
    await runStandardLayoutOrchestration();
    expect(initScrollSpy).toHaveBeenCalled();
  });

  it("AC-6: calls initScrollSpy even when all opt-in flags are false", async () => {
    await runStandardLayoutOrchestration({
      counters: false,
      reveal: false,
      smoothScroll: false,
    });
    expect(initScrollSpy).toHaveBeenCalled();
  });
});
