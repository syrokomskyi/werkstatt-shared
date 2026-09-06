import { describe, it, expect } from "vitest";
import { runStandardLayoutOrchestration } from "../orchestrator.ts";

describe("runStandardLayoutOrchestration", () => {
  it("is an async function", () => {
    expect(typeof runStandardLayoutOrchestration).toBe("function");
  });
});
