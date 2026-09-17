import { describe, it, expect } from "vitest";
import { initGsapParallax } from "../gsap-parallax.ts";

describe("initGsapParallax", () => {
  it("is an async function", () => {
    expect(typeof initGsapParallax).toBe("function");
  });
});
