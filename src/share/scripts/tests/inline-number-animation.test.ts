import { describe, it, expect } from "vitest";
import { initInlineNumberAnimation } from "../inline-number-animation.ts";

describe("initInlineNumberAnimation", () => {
  it("is an async function", () => {
    expect(typeof initInlineNumberAnimation).toBe("function");
  });
});
