import { describe, expect, it } from "vitest";
import { LLMS_DEPTH_BY_SEMANTIC_TYPE, resolveLlmsPolicy } from "../llms-policy.ts";

describe("resolveLlmsPolicy", () => {
  it("returns full depth by default", () => {
    expect(resolveLlmsPolicy(undefined, "content")).toEqual({ depth: "full" });
  });

  it("uses type default for openSource", () => {
    expect(resolveLlmsPolicy(undefined, "openSource")).toEqual({ depth: "index-only" });
  });

  it("uses type default for legal", () => {
    expect(resolveLlmsPolicy(undefined, "legal")).toEqual({ depth: "exclude" });
  });

  it("accepts string shorthand", () => {
    expect(resolveLlmsPolicy("summary", "content")).toEqual({ depth: "summary" });
  });

  it("falls back to type default for invalid string depth", () => {
    expect(resolveLlmsPolicy("invalid" as never, "openSource")).toEqual({ depth: "index-only" });
  });

  it("accepts object form with valid depth", () => {
    expect(resolveLlmsPolicy({ depth: "exclude" }, "content")).toEqual({ depth: "exclude" });
  });

  it("includes section excludes when provided", () => {
    const result = resolveLlmsPolicy(
      { depth: "summary", sections: { exclude: ["s1", "s2"] } },
      "content",
    );
    expect(result.depth).toBe("summary");
    expect(result.sections?.exclude).toEqual(["s1", "s2"]);
  });

  it("filters empty section exclude ids", () => {
    const result = resolveLlmsPolicy(
      { depth: "summary", sections: { exclude: ["s1", ""] } },
      "content",
    );
    expect(result.sections?.exclude).toEqual(["s1"]);
  });

  it("omits sections when no valid excludes", () => {
    const result = resolveLlmsPolicy({ depth: "summary", sections: { exclude: [] } }, "content");
    expect(result.sections).toBeUndefined();
  });
});

describe("LLMS_DEPTH_BY_SEMANTIC_TYPE", () => {
  it("maps openSource to index-only", () => {
    expect(LLMS_DEPTH_BY_SEMANTIC_TYPE.openSource).toBe("index-only");
  });

  it("maps legal to exclude", () => {
    expect(LLMS_DEPTH_BY_SEMANTIC_TYPE.legal).toBe("exclude");
  });
});
