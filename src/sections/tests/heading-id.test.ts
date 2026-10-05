import { test, expect, describe } from "vitest";
import { sectionHeadingId } from "../heading-id.ts";

/**
 * RFC-1196 — sectionHeadingId() fallback chain: non-empty sectionNumber wins,
 * else sectionId (blockId), else the bare type-derived id. Guards the falsy
 * fallback ("" must behave like absent) that prevents duplicate type-derived
 * heading ids on unnumbered sections.
 */
describe("sectionHeadingId", () => {
  test("numbered section prefixes with sectionNumber", () => {
    expect(sectionHeadingId("markdown-section-title", "01", "markdown-intro")).toBe(
      "01-markdown-section-title",
    );
  });

  test("unnumbered section falls back to sectionId", () => {
    expect(sectionHeadingId("markdown-section-title", undefined, "markdown-intro")).toBe(
      "markdown-intro-markdown-section-title",
    );
  });

  test("empty sectionNumber falls back to sectionId (falsy, not nullish)", () => {
    expect(
      sectionHeadingId("markdown-section-title", "", "markdown-intro"),
      'sectionNumber "" must fall back to sectionId — a leading-dash id ("-markdown-section-title") is invalid and non-unique',
    ).toBe("markdown-intro-markdown-section-title");
  });

  test("empty sectionNumber AND empty sectionId yields bare type id", () => {
    expect(sectionHeadingId("markdown-section-title", "", "")).toBe("markdown-section-title");
  });

  test("absent type id yields undefined regardless of prefix", () => {
    expect(sectionHeadingId(undefined, "01", "markdown-intro")).toBeUndefined();
    expect(sectionHeadingId(undefined, undefined, undefined)).toBeUndefined();
  });

  test("type id without any prefix source stays bare (pre-RFC-1196 behavior)", () => {
    expect(sectionHeadingId("markdown-section-title", undefined, undefined)).toBe(
      "markdown-section-title",
    );
  });
});
