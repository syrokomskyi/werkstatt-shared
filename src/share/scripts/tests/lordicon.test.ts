import { describe, it, expect } from "vitest";
import { initLordIconOnDemand } from "../lordicon.ts";

describe("initLordIconOnDemand", () => {
  it("is a function", () => {
    expect(typeof initLordIconOnDemand).toBe("function");
  });
});
