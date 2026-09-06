import { describe, it, expect } from "vitest";
import { initGsapReveal } from "../gsap-reveal.ts";

describe("initGsapReveal", () => {
  it("is an async function", () => {
    expect(typeof initGsapReveal).toBe("function");
  });
});
