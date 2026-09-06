import { describe, it, expect } from "vitest";
import { initMountainJourneyAnimation } from "../gsap-mountain-journey.ts";

describe("initMountainJourneyAnimation", () => {
  it("is an async function", () => {
    expect(typeof initMountainJourneyAnimation).toBe("function");
  });
});
