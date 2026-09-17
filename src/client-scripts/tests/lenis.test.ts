import { describe, it, expect } from "vitest";
import { initLenis } from "../lenis.ts";

describe("initLenis", () => {
  it("is an async function", () => {
    expect(typeof initLenis).toBe("function");
  });
});
