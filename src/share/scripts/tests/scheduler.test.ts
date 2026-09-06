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
