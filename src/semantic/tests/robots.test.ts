import { describe, expect, it } from "vitest";
import {
  AI_TRAINING_CRAWLER_REGISTRY,
  buildRobotsTxt,
  deriveAiTrainingUserAgents,
} from "../robots.ts";

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

describe("buildRobotsTxt — AI-training derivation (RFC-1161)", () => {
  const aiTrainNo = ["ai-train=no", "search=yes", "ai-input=yes"];

  it("emits the derived group with all registry tokens when ai-train=no", () => {
    const result = buildRobotsTxt({ contentSignal: aiTrainNo });
    expect(result).toContain(
      "# AI-training crawlers — derived from Content-Signal ai-train=no (RFC-1161)",
    );
    for (const token of AI_TRAINING_CRAWLER_REGISTRY) {
      expect(result).toContain(`User-agent: ${token.userAgent}`);
    }
    // The derived group ends with a single Disallow: / line.
    expect(result).toMatch(/VelenPublicWebCrawler\nDisallow: \/\n/);
  });

  it("produces byte-identical output without ai-train=no (AC-2 regression)", () => {
    const withoutSignal = buildRobotsTxt({});
    const otherSignals = buildRobotsTxt({ contentSignal: ["search=yes", "ai-input=yes"] });
    const aiTrainYes = buildRobotsTxt({ contentSignal: ["ai-train=yes", "search=yes"] });
    expect(withoutSignal).not.toContain("AI-training crawlers");
    expect(otherSignals).not.toContain("AI-training crawlers");
    expect(aiTrainYes).not.toContain("AI-training crawlers");
    // Other signals only add the Content-Signal line; body is identical.
    expect(otherSignals.replace(/^Content-Signal: .*\n\n/m, "")).toBe(withoutSignal);
  });

  it("places the derived group after the complete default group and before allowlist", () => {
    const result = buildRobotsTxt({
      contentSignal: aiTrainNo,
      crawlerAllowlist: ["FriendlyBot"],
    });
    const auxIdx = result.indexOf("Allow: /sitemap-content.xml");
    const markerIdx = result.indexOf("AI-training crawlers");
    const allowIdx = result.indexOf("User-agent: FriendlyBot");
    expect(auxIdx).toBeGreaterThan(-1);
    expect(markerIdx).toBeGreaterThan(auxIdx);
    expect(allowIdx).toBeGreaterThan(markerIdx);
  });

  it("matches ai-train=no case-insensitively with trimmed whitespace", () => {
    const result = buildRobotsTxt({ contentSignal: ["  AI-Train=No ", "search=yes"] });
    expect(result).toContain("AI-training crawlers");
  });

  it("dedupes tokens already covered by crawlerBlocklist", () => {
    const result = buildRobotsTxt({
      contentSignal: aiTrainNo,
      crawlerBlocklist: ["GPTBot"],
    });
    // GPTBot appears exactly once — in the blocklist group, not the derived group.
    expect(result.match(/User-agent: GPTBot/g)).toHaveLength(1);
    expect(result).toContain("AI-training crawlers");
    expect(result).toContain("User-agent: ClaudeBot");
  });

  it("dedupes tokens covered by a customRules entry", () => {
    const result = buildRobotsTxt({
      contentSignal: aiTrainNo,
      customRules: [{ userAgent: "CCBot", disallow: ["/tmp"], allow: [] }],
    });
    expect(result.match(/User-agent: CCBot/g)).toHaveLength(1);
    expect(result).toContain("AI-training crawlers");
  });

  it("emits no derived group when every token is explicitly covered", () => {
    const result = buildRobotsTxt({
      contentSignal: aiTrainNo,
      crawlerBlocklist: AI_TRAINING_CRAWLER_REGISTRY.map((e) => e.userAgent),
    });
    expect(result).not.toContain("AI-training crawlers");
  });

  it("exposes deriveAiTrainingUserAgents for validators", () => {
    expect(deriveAiTrainingUserAgents({ contentSignal: aiTrainNo })).toHaveLength(
      AI_TRAINING_CRAWLER_REGISTRY.length,
    );
    expect(deriveAiTrainingUserAgents({})).toHaveLength(0);
    expect(
      deriveAiTrainingUserAgents({
        contentSignal: aiTrainNo,
        crawlerAllowlist: ["GPTBot"], // allowlist does NOT dedupe — it is a contradiction (AITRAIN-02)
      }),
    ).toContain("GPTBot");
  });
});
