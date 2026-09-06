import { describe, it, expect } from "vitest";
import { initGsapStagger } from "../gsap-stagger.ts";

describe("initGsapStagger", () => {
  it("is an async function", () => {
    expect(typeof initGsapStagger).toBe("function");
  });
});
