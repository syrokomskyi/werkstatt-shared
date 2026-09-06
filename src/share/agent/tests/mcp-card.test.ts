import { describe, it, expect } from "vitest";
import { buildMcpServerCard } from "../mcp-card.ts";

describe("buildMcpServerCard", () => {
  it("is a function", () => {
    expect(typeof buildMcpServerCard).toBe("function");
  });
});
