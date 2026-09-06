import { describe, it, expect } from "vitest";
import { formatAgentOpenApi } from "../openapi.ts";

describe("formatAgentOpenApi", () => {
  it("is a function", () => {
    expect(typeof formatAgentOpenApi).toBe("function");
  });
});
