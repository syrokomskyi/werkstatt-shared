import { describe, expect, it } from "vitest";
import { buildAiTxt } from "../ai.ts";

describe("buildAiTxt", () => {
  it("generates header from siteUrl", () => {
    const result = buildAiTxt({ policy: "allow" }, "https://example.com");
    expect(result).toContain("# ai.txt for example.com");
    expect(result).toContain("policy: allow");
  });

  it("includes version and updated", () => {
    const result = buildAiTxt({ policy: "allow", version: "1.0", updated: "2024-01-01" }, "https://example.com");
    expect(result).toContain("version: 1.0");
    expect(result).toContain("updated: 2024-01-01");
  });

  it("includes optional fields when provided", () => {
    const result = buildAiTxt({
      policy: "limited",
      training: "disallow",
      usage: ["search", "summarization"],
      commercial: "no",
      attribution: "required",
      license: "CC-BY-4.0",
    }, "https://example.com");
    expect(result).toContain("training: disallow");
    expect(result).toContain("usage: search, summarization");
    expect(result).toContain("commercial: no");
    expect(result).toContain("attribution: required");
    expect(result).toContain("license: CC-BY-4.0");
  });

  it("emits provider sections", () => {
    const result = buildAiTxt({
      policy: "allow",
      providers: [
        { name: "OpenAI", policy: "disallow", training: "disallow" },
        { name: "Anthropic", policy: "allow", url: "https://anthropic.com" },
      ],
    }, "https://example.com");
    expect(result).toContain("[OpenAI]");
    expect(result).toContain("[Anthropic]");
    expect(result).toContain("url: https://anthropic.com");
  });

  it("includes url and contact in header comments", () => {
    const result = buildAiTxt({
      policy: "allow",
      url: "https://example.com/policy",
      contact: "info@example.com",
    }, "https://example.com");
    expect(result).toContain("# See: https://example.com/policy");
    expect(result).toContain("# Contact: info@example.com");
  });
});
