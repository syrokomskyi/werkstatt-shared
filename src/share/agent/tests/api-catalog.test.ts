import { describe, it, expect } from "vitest";
import { buildApiCatalog } from "../api-catalog.ts";

describe("buildApiCatalog", () => {
  it("is a function", () => {
    expect(typeof buildApiCatalog).toBe("function");
  });
});
