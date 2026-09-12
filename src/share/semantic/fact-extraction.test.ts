import { describe, test, expect } from "vitest";
import { normalizeFactValue, type CanonicalFact } from "./fact-extraction.ts";

describe("fact-extraction: normalizeFactValue", () => {
  test("normalizes email to lowercase", () => {
    expect(normalizeFactValue("email", "Info@Test.COM")).toBe("info@test.com");
  });

  test("normalizes phone by stripping tel: prefix and separators", () => {
    expect(normalizeFactValue("phone", "tel:+49 30 123-4567")).toBe("+49301234567");
  });

  test("normalizes phone by stripping spaces, hyphens, and parentheses", () => {
    expect(normalizeFactValue("phone", "+49 (30) 123-4567")).toBe("+49301234567");
  });

  test("trims whitespace for other types", () => {
    expect(normalizeFactValue("price", "  2900  ")).toBe("2900");
  });

  test("trims whitespace for name", () => {
    expect(normalizeFactValue("name", "  Test Business  ")).toBe("Test Business");
  });

  test("handles empty string", () => {
    expect(normalizeFactValue("email", "")).toBe("");
    expect(normalizeFactValue("phone", "")).toBe("");
    expect(normalizeFactValue("price", "")).toBe("");
  });
});

describe("fact-extraction: CanonicalFact interface", () => {
  test("CanonicalFact can be constructed with all fields", () => {
    const fact: CanonicalFact = {
      type: "price",
      entityId: "offering-1",
      entityType: "offering",
      value: "2900",
      surface: "canonical",
      source: "pbp",
    };
    expect(fact.type).toBe("price");
    expect(fact.entityId).toBe("offering-1");
    expect(fact.value).toBe("2900");
    expect(fact.surface).toBe("canonical");
  });
});
