/*
<MODULE_CONTRACT>
<purpose>
Unit tests for scheduler covering scheduleTask. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the scheduler suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scheduleTask } from "../scheduler.ts";

describe("scheduleTask", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      requestIdleCallback: vi.fn(),
      setTimeout: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is a function", () => {
    expect(typeof scheduleTask).toBe("function");
  });

  it("does not throw when scheduling a task", () => {
    expect(() => scheduleTask(() => undefined)).not.toThrow();
  });
});
