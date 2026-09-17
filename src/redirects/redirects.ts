/*
<MODULE_CONTRACT>
<purpose>App-agnostic _redirects file parsing for reuse across site-kernel-checks and site-kernel-handoff (RFC-0588).</purpose>
<non-goals>
  <item>Do not handle advanced Cloudflare Pages syntax (query parameters, placeholders) — only whitespace-delimited `from to status` lines.</item>
  <item>Do not perform glob-to-regex conversion — that is the consumer's responsibility.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0588: extracted parseRedirectRules and RedirectRule from site-kernel-checks/managed-public.ts into @warpgogol/werkstatt-shared/redirects subpath.</item>
  <item>RFC-0595: add extractRedirectTarget helper for parsing url= from meta-refresh tags.</item>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

export type RedirectRule = {
  from: string;
  to: string | undefined;
  status: number;
  line: string;
};

/**
 * File extensions excluded from trailing-slash normalization in the Cloudflare Worker
 * `isPageRoute` function. If a request URL ends with one of these extensions, the Worker
 * must NOT 308-redirect it to a trailing-slash URL (which would cause a 404).
 *
 * This is the single source of truth — injected into worker.ts.template and
 * markdown-negotiation.ts.template via the `{{EXCLUDED_EXTENSIONS}}` placeholder.
 * The `trailing.slash.config.validate` SLASH-04 rule scans `public/` for file extensions
 * not in this list and fails the build.
 *
 * When adding a new media/asset type to `public/`, add its extension here.
 */
export const PAGE_ROUTE_EXCLUDED_EXTENSIONS: readonly string[] = [
  "ico",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "avif",
  "gif",
  "bmp",
  "svg",
  "css",
  "js",
  "mjs",
  "json",
  "txt",
  "xml",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "webmanifest",
  "md",
  "pdf",
  "webm",
  "mp4",
  "wasm",
  "map",
  "m3u8",
  "ts",
  "html",
  "ndjson",
  "vtt",
  "yaml",
];

/**
 * Build a regex string (without delimiters) that matches any of the excluded extensions.
 * Used by the codegen to inject the alternation into the `isPageRoute` regex.
 */
export function buildPageRouteExclusionAlternation(
  extensions: readonly string[] = PAGE_ROUTE_EXCLUDED_EXTENSIONS,
): string {
  return extensions.join("|");
}

export function parseRedirectRules(body: string): RedirectRule[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [from, to, statusRaw] = line.split(/\s+/);
      return {
        from: from ?? "",
        to,
        status: Number(statusRaw ?? 301),
        line,
      };
    })
    .filter((rule) => rule.from.length > 0);
}

/**
 * Extract the redirect target URL from a `<meta http-equiv="refresh" content="0;url=...">` tag.
 * Returns the immediate target only (first hop). Returns null if the tag is
 * absent or the url= value cannot be parsed.
 */
export function extractRedirectTarget(html: string): string | null {
  const m = html.match(
    /<meta[^>]+http-equiv=["']refresh["'][^>]*content=["']\s*\d+\s*;\s*url=([^"']+)['"][^>]*>/i,
  );
  if (m?.[1]) return m[1].trim();
  const m2 = html.match(
    /<meta[^>]+content=["']\s*\d+\s*;\s*url=([^"']+)['"][^>]*http-equiv=["']refresh["'][^>]*>/i,
  );
  if (m2?.[1]) return m2[1].trim();
  return null;
}
