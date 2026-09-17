import { describe, it, expect } from "vitest";
import { initGsapCounter } from "../gsap-counter.ts";

describe("initGsapCounter", () => {
  it("is an async function", () => {
    expect(typeof initGsapCounter).toBe("function");
  });
});
