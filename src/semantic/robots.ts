/*
<MODULE_CONTRACT>
<purpose>
  RFC-0052 robots.txt generation. Pure function buildRobotsTxt produces the
  robots exclusion standard file from a structured RobotsPolicy config.
</purpose>
<non-goals>
  <item>Do not read content files or validate input — the caller is responsible.</item>
  <item>Do not manage default policy fallback — caller decides skip vs fallback.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0052: Initial implementation.</item>
  <item>RFC-0784: Add contentSignal field and Content-Signal directive output.</item>
  <item>RFC-1161: derive named AI-training bot blocks in robots.txt from Content-Signal

AI_TRAINING_CRAWLER_REGISTRY (14 train tokens) + derived User-agent
group in buildRobotsTxt when contentSignal declares ai-train=no, deduped
against crawlerBlocklist/customRules. ROBOTS-AITRAIN-01 (missing derived
group) and ROBOTS-AITRAIN-02 (policy self-contradiction) in
robots.validate; rule registry entries; robots.validate registered in
build-prepare after robots.generate (first pipeline placement). Fix
upstream dead config: robots block now declared in systemManifestSchema
(manifest.robots was stripped by strict parse).</item>
</CHANGE_SUMMARY>
*/

export interface RobotsRule {
  userAgent: string;
  disallow: string[];
  allow: string[];
}

export interface RobotsPolicy {
  defaultPolicy?: "allow" | "disallow";
  disallowedPaths?: string[];
  allowedPaths?: string[];
  crawlerBlocklist?: string[];
  crawlerAllowlist?: string[];
  sitemap?: string;
  customRules?: RobotsRule[];
  /** RFC-0784: Content-Signal directive — AI usage preferences (ai-train, search, ai-input). */
  contentSignal?: string[];
}

/** Product-token categories for AI crawlers (RFC-1161). */
export type AiCrawlerCategory = "train" | "search" | "input";

export interface AiCrawlerRegistryEntry {
  /** Exact robots.txt User-agent product token. */
  userAgent: string;
  category: AiCrawlerCategory;
}

/** Workshop-owned registry of known AI crawler product tokens (RFC-1161).
 *  Only "train" entries participate in the derived Disallow group.
 *  Registry changes are platform commits; sites inherit via regeneration. */
export const AI_TRAINING_CRAWLER_REGISTRY: readonly AiCrawlerRegistryEntry[] = [
  { userAgent: "GPTBot", category: "train" },
  { userAgent: "Bytespider", category: "train" },
  { userAgent: "CCBot", category: "train" },
  { userAgent: "Google-Extended", category: "train" },
  { userAgent: "Applebot-Extended", category: "train" },
  { userAgent: "ClaudeBot", category: "train" },
  { userAgent: "anthropic-ai", category: "train" },
  { userAgent: "cohere-ai", category: "train" },
  { userAgent: "Meta-ExternalAgent", category: "train" },
  { userAgent: "AI2Bot", category: "train" },
  { userAgent: "Diffbot", category: "train" },
  { userAgent: "Webzio-Extended", category: "train" },
  { userAgent: "Timpibot", category: "train" },
  { userAgent: "VelenPublicWebCrawler", category: "train" },
];

/** Marker comment line identifying the derived AI-training group (RFC-1161). */
export const AI_TRAINING_GROUP_MARKER =
  "# AI-training crawlers — derived from Content-Signal ai-train=no (RFC-1161)";

/** RFC-1161: true when the policy's Content-Signal declares ai-train=no.
 *  Entries are matched whitespace-tolerant at the edges and case-insensitively
 *  (Content-Signal tokens are canonically lowercase, but hand-edited manifests
 *  must not defeat the derivation). One-directional: ai-train=yes or absence
 *  emits nothing. */
export function declaresAiTrainNo(policy: RobotsPolicy): boolean {
  return (policy.contentSignal ?? []).some((entry) => entry.trim().toLowerCase() === "ai-train=no");
}

/** RFC-1161: train-category registry tokens covered by the derived group for
 *  this policy. Tokens already covered by crawlerBlocklist or a
 *  customRules[].userAgent entry are excluded — the site's explicit per-bot
 *  configuration wins, and duplicate User-agent groups for the same product
 *  token are never emitted (RFC 9309 leaves multi-group merging to crawlers). */
export function deriveAiTrainingUserAgents(policy: RobotsPolicy): string[] {
  if (!declaresAiTrainNo(policy)) {
    return [];
  }
  const explicitTokens = new Set([
    ...(policy.crawlerBlocklist ?? []),
    ...(policy.customRules ?? []).map((rule) => rule.userAgent),
  ]);
  return AI_TRAINING_CRAWLER_REGISTRY.filter(
    (entry) => entry.category === "train" && !explicitTokens.has(entry.userAgent),
  ).map((entry) => entry.userAgent);
}

/** RFC-1161: canonical rendered lines of the derived AI-training crawler group.
 *  Shared by the generator and robots.validate (AITRAIN-01) so the presence
 *  check can never drift from what the generator emits. */
export function aiTrainingCrawlerGroupLines(userAgents: readonly string[]): string[] {
  return [
    AI_TRAINING_GROUP_MARKER,
    ...userAgents.map((userAgent) => `User-agent: ${userAgent}`),
    "Disallow: /",
  ];
}

export function buildRobotsTxt(policy: RobotsPolicy): string {
  const lines: string[] = [];

  lines.push("# robots.txt");
  lines.push(`# Generated by robots.generate (RFC-0052)`);
  lines.push("");

  // RFC-0784: Content-Signal directive — placed after header comment, before User-agent block.
  if (policy.contentSignal && policy.contentSignal.length > 0) {
    lines.push(`Content-Signal: ${policy.contentSignal.join(", ")}`);
    lines.push("");
  }

  const defaultPolicy = policy.defaultPolicy ?? "allow";
  const defaultDisallow = policy.disallowedPaths ?? [];
  const defaultAllow = policy.allowedPaths ?? [];
  const blocklist = policy.crawlerBlocklist ?? [];
  const allowlist = policy.crawlerAllowlist ?? [];
  const customRules = policy.customRules ?? [];

  // Default User-agent group
  lines.push("# Default crawl policy");
  lines.push("User-agent: *");

  if (defaultPolicy === "disallow") {
    if (defaultDisallow.length === 0) {
      lines.push("Disallow: /");
    } else {
      for (const path of defaultDisallow) {
        lines.push(`Disallow: ${path}`);
      }
    }
  } else if (defaultDisallow.length > 0 || defaultAllow.length > 0) {
    // Default allow with specific overrides
    for (const path of defaultAllow) {
      lines.push(`Allow: ${path}`);
    }
    for (const path of defaultDisallow) {
      lines.push(`Disallow: ${path}`);
    }
  }
  // Default allow with no overrides — omit redundant "Allow: /" (PUBTXT-09);
  // the auxiliary discovery files below are explicitly allowed.

  // Auxiliary discovery files — explicitly allowed for all crawlers
  lines.push("");
  lines.push("# Auxiliary discovery files — explicitly allowed for all crawlers");
  lines.push("Allow: /robots.txt");
  lines.push("Allow: /llms.txt");
  lines.push("Allow: /llms-full.txt");
  lines.push("Allow: /sitemap.xml");
  lines.push("Allow: /sitemap-content.xml");

  // RFC-1161: derived AI-training crawler group — emitted when the policy
  // declares ai-train=no. Placed after the complete default group (the
  // auxiliary Allow lines above belong to User-agent: *) and before the
  // allowlist/blocklist groups.
  const aiTrainingTokens = deriveAiTrainingUserAgents(policy);
  if (aiTrainingTokens.length > 0) {
    lines.push("");
    lines.push(...aiTrainingCrawlerGroupLines(aiTrainingTokens));
  }

  // Crawler allowlist (friendly AI / search crawlers)
  if (allowlist.length > 0) {
    lines.push("");
    lines.push("# Allow known friendly crawlers explicitly");
    for (const agent of allowlist) {
      lines.push(`User-agent: ${agent}`);
    }
    lines.push("Allow: /");
  }

  // Crawler blocklist
  if (blocklist.length > 0) {
    lines.push("");
    lines.push("# Block known low-value crawlers");
    for (const agent of blocklist) {
      lines.push(`User-agent: ${agent}`);
    }
    lines.push("Disallow: /");
  }

  // Custom per-user-agent rules
  for (const rule of customRules) {
    lines.push("");
    lines.push(`User-agent: ${rule.userAgent}`);
    for (const path of rule.disallow) {
      lines.push(`Disallow: ${path}`);
    }
    for (const path of rule.allow) {
      lines.push(`Allow: ${path}`);
    }
  }

  // Sitemap reference
  const sitemap = policy.sitemap ?? "/sitemap.xml";
  lines.push("");
  lines.push(`Sitemap: ${sitemap}`);

  return lines.join("\n") + "\n";
}
