import { describe, it, expect } from "vitest";
import { applyExternalLinkBehavior } from "../external-links.ts";

describe("applyExternalLinkBehavior", () => {
  it("is a function", () => {
    expect(typeof applyExternalLinkBehavior).toBe("function");
  });
});
