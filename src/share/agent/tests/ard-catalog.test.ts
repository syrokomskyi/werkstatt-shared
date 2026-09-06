import { describe, it, expect } from "vitest";
import { buildArdCatalog } from "../ard-catalog.ts";

describe("buildArdCatalog", () => {
  it("is a function", () => {
    expect(typeof buildArdCatalog).toBe("function");
  });
});
