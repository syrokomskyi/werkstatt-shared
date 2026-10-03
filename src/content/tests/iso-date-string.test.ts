import { describe, test, expect } from "vitest";
import { toIsoDateString } from "../iso-date-string.ts";

describe("toIsoDateString (ADR-0105)", () => {
  test("valid Date → ISO string", () => {
    expect(toIsoDateString(new Date("2026-09-18T20:34:40.542Z"))).toBe(
      "2026-09-18T20:34:40.542Z",
    );
  });

  test("invalid Date → empty string (toISOString would throw RangeError)", () => {
    expect(toIsoDateString(new Date("garbage"))).toBe("");
  });

  test("string passes through unchanged", () => {
    expect(toIsoDateString("2026-09-18")).toBe("2026-09-18");
    expect(toIsoDateString("not a date")).toBe("not a date");
  });

  test("non-date values degrade to empty string", () => {
    expect(toIsoDateString({})).toBe("");
    expect(toIsoDateString(42)).toBe("");
    expect(toIsoDateString(null)).toBe("");
    expect(toIsoDateString(undefined)).toBe("");
    expect(toIsoDateString([])).toBe("");
  });
});
