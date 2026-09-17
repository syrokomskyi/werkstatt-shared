import { describe, expect, it } from "vitest";
import { buildRobotsTxt } from "../robots.ts";

describe("buildRobotsTxt", () => {
  it("generates default allow policy", () => {
    const result = buildRobotsTxt({});
    expect(result).toContain("User-agent: *");
    expect(result).not.toContain("Disallow: /");
    expect(result).toContain("Allow: /robots.txt");
    expect(result).toContain("Sitemap: /sitemap.xml");
  });

  it("generates disallow-all for defaultPolicy: disallow", () => {
    const result = buildRobotsTxt({ defaultPolicy: "disallow" });
    expect(result).toContain("Disallow: /");
  });

  it("generates specific disallow paths", () => {
    const result = buildRobotsTxt({ disallowedPaths: ["/admin", "/private"] });
    expect(result).toContain("Disallow: /admin");
    expect(result).toContain("Disallow: /private");
    expect(result).not.toContain("Disallow: /\n");
  });

  it("generates allow paths in allow mode", () => {
    const result = buildRobotsTxt({ allowedPaths: ["/public"] });
    expect(result).toContain("Allow: /public");
  });

  it("emits Content-Signal directive when provided", () => {
    const result = buildRobotsTxt({ contentSignal: ["ai-train", "search"] });
    expect(result).toContain("Content-Signal: ai-train, search");
  });

  it("emits crawler blocklist", () => {
    const result = buildRobotsTxt({ crawlerBlocklist: ["BadBot", "ScraperBot"] });
    expect(result).toContain("User-agent: BadBot");
    expect(result).toContain("User-agent: ScraperBot");
    expect(result).toContain("Disallow: /");
  });

  it("emits crawler allowlist", () => {
    const result = buildRobotsTxt({ crawlerAllowlist: ["FriendlyBot"] });
    expect(result).toContain("User-agent: FriendlyBot");
    expect(result).toContain("Allow: /");
  });

  it("emits custom per-user-agent rules", () => {
    const result = buildRobotsTxt({
      customRules: [{ userAgent: "GoogleBot", disallow: ["/no-google"], allow: ["/yes-google"] }],
    });
    expect(result).toContain("User-agent: GoogleBot");
    expect(result).toContain("Disallow: /no-google");
    expect(result).toContain("Allow: /yes-google");
  });

  it("uses custom sitemap URL", () => {
    const result = buildRobotsTxt({ sitemap: "https://example.com/sitemap.xml" });
    expect(result).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("always allows auxiliary discovery files", () => {
    const result = buildRobotsTxt({ defaultPolicy: "disallow" });
    expect(result).toContain("Allow: /robots.txt");
    expect(result).toContain("Allow: /llms.txt");
    expect(result).toContain("Allow: /llms-full.txt");
    expect(result).toContain("Allow: /sitemap.xml");
    expect(result).toContain("Allow: /sitemap-content.xml");
  });
});
