/*
<MODULE_CONTRACT>
<purpose>
RFC-0235 egress text normalizer. A server-only adapter that strips AI-authorship
typographic signals (special dashes, curly/guillemet quotes, special + zero-width
spaces, typographic HTML entities, single-char ellipsis) from text on its way to
public output. Pure string transforms — no DOM, no heavy parser — safe in SSR/SSG
frontmatter, kernel build steps, and the OG-image generator. Authored sources are
never touched; this only transforms output strings.
</purpose>
<non-goals>
  <item>Do not import in browser scripts — server-only (entity decode + Node usage assumptions).</item>
  <item>Do not touch structural HTML/JSON/XML syntax or the structural entities &amp; &lt; &gt; &quot; &#39;.</item>
  <item>Do not normalize text inside code/pre/script/style or fenced/inline Markdown code.</item>
  <item>Do not apply heuristics that distinguish "intentional" from "AI" typography — blanket per signal.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0235: initial egress text normalizer.</item>
  <item>RFC-0569: add createDevNormalizeMiddleware for dev/prod egress parity.</item>
  <item>RFC-1070: add U+02BC modifier letter apostrophe to quotes signal.</item>
  <item>RFC-1446: enforce uzbek apostrophe orthography and russian heading case</item>
</CHANGE_SUMMARY>
*/

// @ai-invariant: RFC-0235. Server-only. Never import in browser scripts.
// All special-character sets are expressed as \u escapes — never literal glyphs —
// so the source contains no invisible characters and the matchers are auditable.
// RFC-0569: createDevNormalizeMiddleware adds a dev-only Astro middleware factory.

import type { MiddlewareHandler } from "astro";

export type SignalId = "dashes" | "quotes" | "spaces" | "zeroWidth" | "htmlEntities" | "ellipsis";

export const SIGNAL_IDS: readonly SignalId[] = [
  "dashes",
  "quotes",
  "spaces",
  "zeroWidth",
  "htmlEntities",
  "ellipsis",
] as const;

export interface NormalizeConfig {
  /** Master switch. When false, every normalizer is a no-op. */
  enabled: boolean;
  /** Per-signal toggle. An absent signal defaults to ON. */
  signals: Record<SignalId, boolean>;
}

export interface SignalSpec {
  id: SignalId;
  title: string;
  /** Human-readable summary of the matched Unicode set. */
  unicode: string;
  /** Human-readable replacement description. */
  replacement: string;
  /** Default gating — always true (everything on by default, RFC-0235). */
  default: boolean;
}

/**
 * The single source of truth for the signal taxonomy. Consumed by
 * `text.normalize.rules.list`, the validators, and the transforms.
 */
export const SIGNAL_REGISTRY: readonly SignalSpec[] = [
  {
    id: "dashes",
    title: "Special dashes",
    unicode: "U+2010 U+2011 U+2012 U+2013 U+2014 U+2015 U+2212",
    replacement: "hyphen-minus '-' (surrounding spaces preserved)",
    default: true,
  },
  {
    id: "quotes",
    title: "Typographic / smart quotes",
    unicode: "U+00AB U+00BB U+2018-U+201F U+02BC",
    replacement: "straight double / single quote",
    default: true,
  },
  {
    id: "spaces",
    title: "Special spaces",
    unicode: "U+00A0 U+1680 U+2000-U+200A U+202F U+205F U+3000",
    replacement: "regular space U+0020 (1:1, runs not collapsed)",
    default: true,
  },
  {
    id: "zeroWidth",
    title: "Zero-width / invisible characters",
    unicode: "U+00AD U+061C U+180E U+200B U+200C U+200D* U+2060 U+2061-U+2064 U+FEFF",
    replacement: "removed (ZWJ inside emoji sequences preserved)",
    default: true,
  },
  {
    id: "htmlEntities",
    title: "Typographic HTML entities",
    unicode:
      "&nbsp; &mdash; &ndash; &hellip; &laquo; &raquo; &ldquo; &rdquo; &lsquo; &rsquo; &#160; &#8212;",
    replacement: "decoded, then routed through the matching char signal",
    default: true,
  },
  {
    id: "ellipsis",
    title: "Single-character ellipsis",
    unicode: "U+2026",
    replacement: "three dots '...'",
    default: true,
  },
];

/** All-on config (the default, applied when no `text.normalize` block is present). */
export const DEFAULT_NORMALIZE_CONFIG: NormalizeConfig = {
  enabled: true,
  signals: {
    dashes: true,
    quotes: true,
    spaces: true,
    zeroWidth: true,
    htmlEntities: true,
    ellipsis: true,
  },
};

/**
 * Resolve the effective normalize config from a parsed system manifest.
 * Absent block ⇒ all signals on. Absent individual signal ⇒ on.
 */
export function resolveNormalizeConfig(manifest: unknown): NormalizeConfig {
  const block = (manifest as { text?: { normalize?: unknown } } | null | undefined)?.text
    ?.normalize as { enabled?: unknown; signals?: Record<string, unknown> } | undefined;
  if (!block || typeof block !== "object") {
    return { ...DEFAULT_NORMALIZE_CONFIG, signals: { ...DEFAULT_NORMALIZE_CONFIG.signals } };
  }
  const enabled = block.enabled === undefined ? true : block.enabled !== false;
  const sig = block.signals ?? {};
  const signals = {} as Record<SignalId, boolean>;
  for (const id of SIGNAL_IDS) {
    signals[id] = sig[id] === undefined ? true : sig[id] !== false;
  }
  return { enabled, signals };
}

// ---------------------------------------------------------------------------
// Character-level transforms (sets are \u escapes — no literal glyphs)
// ---------------------------------------------------------------------------

// U+2010 hyphen, U+2011 non-breaking hyphen, U+2012 figure dash, U+2013 en dash,
// U+2014 em dash, U+2015 horizontal bar, U+2212 minus sign.
const RE_DASHES = /[‐‑‒–—―−]/g;
// U+00AB U+00BB U+201C U+201D U+201E U+201F
const RE_QUOTES_DOUBLE = /[«»“”„‟]/g;
// U+2018 U+2019 U+201A U+201B U+02BC (modifier letter apostrophe, RFC-1070)
const RE_QUOTES_SINGLE = /[‘’‚‛ʼ]/g;
// U+2018 U+2019 U+201A U+201B — always typographic, in every locale.
const RE_QUOTES_SINGLE_BASE = /[‘’‚‛]/g;
// U+02BC NOT between letters — a bare or edge ʼ is still a quote signal even
// in orthographic locales; only the letter-internal ʼ is a tutuq belgisi.
const RE_ORTHO_STANDALONE_APOS = /(?<!\p{L})ʼ|ʼ(?!\p{L})/gu;
const RE_ELLIPSIS = /…/g;
// U+00A0 nbsp, U+1680 ogham, U+2000-U+200A, U+202F narrow nbsp, U+205F medium math,
// U+3000 ideographic space.
const RE_SPACES = /[\u00a0  -\u200a\u202f 　]/g;
// Zero-width / invisible cruft: U+00AD soft hyphen, U+061C arabic letter mark,
// U+180E Mongolian vowel sep, U+200B ZWSP, U+200C ZWNJ, U+2060 word joiner,
// U+2061-U+2064 invisible math ops, U+FEFF BOM/ZWNBSP. NOTE: U+200D (ZWJ) is
// handled separately to preserve emoji ZWJ sequences. Directional marks
// (U+200E/U+200F) are intentionally excluded — meaningful for RTL content.
const RE_ZERO_WIDTH = /[\u00ad\u061c\u180e\u200b\u200c\u2060\u2061-\u2064\ufeff]/g;
// Standalone ZWJ: only when NOT bridging two emoji components.
const EMOJI_PART = "[\\p{Extended_Pictographic}\\uFE0F\\u{1F3FB}-\\u{1F3FF}]";
const RE_STANDALONE_ZWJ = new RegExp(`(?<!${EMOJI_PART})\\u200D|\\u200D(?!${EMOJI_PART})`, "gu");

/**
 * RFC-1446: primary subtags whose orthography treats U+02BC as a LETTER
 * (Uzbek tutuq belgisi), not a quote. Extend only with a reviewed letter
 * list for the new locale — the `quotes` signal keeps its old behavior for
 * every locale outside this set.
 */
export const ORTHOGRAPHIC_APOSTROPHE_LOCALES: ReadonlySet<string> = new Set(["uz"]);

/** BCP-47 primary subtag, lowercased — "uz-Latn" → "uz". */
export function primaryLocaleSubtag(locale: string | null | undefined): string | undefined {
  if (!locale) return undefined;
  const primary = locale.trim().toLowerCase().split(/[-_]/, 2)[0];
  return primary || undefined;
}

export function isOrthographicApostropheLocale(locale: string | null | undefined): boolean {
  const primary = primaryLocaleSubtag(locale);
  return primary !== undefined && ORTHOGRAPHIC_APOSTROPHE_LOCALES.has(primary);
}

/** Per-call options. `locale` consults ORTHOGRAPHIC_APOSTROPHE_LOCALES only. */
export interface NormalizeOptions {
  locale?: string;
}

/**
 * RFC-1446: derive a site-relative route path's locale — first path segment
 * when it names a supported locale ("/uz/o-kompanii" → "uz"), else the
 * manifest default. Returns undefined when neither is known; callers record
 * the artifact instead of guessing.
 */
export function localeForRoutePath(
  routePath: string,
  supportedLocales: readonly string[],
  defaultLocale?: string,
): string | undefined {
  const first = routePath.replace(/^\/+/, "").split("/", 2)[0];
  if (first && supportedLocales.includes(first)) return first;
  return defaultLocale;
}

const RE_HTML_LANG = /<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i;

/** Extract `<html lang="…">` — the authoritative locale of a rendered page. */
export function htmlLangOf(html: string): string | undefined {
  return RE_HTML_LANG.exec(html)?.[1];
}

function applyCharSignals(
  input: string,
  cfg: NormalizeConfig,
  opts?: NormalizeOptions,
): string {
  let s = input;
  if (cfg.signals.dashes) s = s.replace(RE_DASHES, "-");
  if (cfg.signals.ellipsis) s = s.replace(RE_ELLIPSIS, "...");
  if (cfg.signals.quotes) {
    s = s.replace(RE_QUOTES_DOUBLE, '"');
    s = isOrthographicApostropheLocale(opts?.locale)
      ? s.replace(RE_QUOTES_SINGLE_BASE, "'").replace(RE_ORTHO_STANDALONE_APOS, "'")
      : s.replace(RE_QUOTES_SINGLE, "'");
  }
  if (cfg.signals.spaces) s = s.replace(RE_SPACES, " ");
  if (cfg.signals.zeroWidth) {
    s = s.replace(RE_ZERO_WIDTH, "").replace(RE_STANDALONE_ZWJ, "");
  }
  return s;
}

// ---------------------------------------------------------------------------
// Typographic HTML entity decoding (the `htmlEntities` lens)
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: "\u00a0",
  ensp: " ",
  emsp: " ",
  emsp13: " ",
  emsp14: " ",
  numsp: "\u2007",
  puncsp: " ",
  thinsp: "\u2009",
  hairsp: "\u200a",
  mdash: "—",
  ndash: "–",
  dash: "‐",
  horbar: "―",
  minus: "−",
  hellip: "…",
  mldr: "…",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  bdquo: "„",
  sbquo: "‚",
  shy: "\u00ad",
  zwnj: "\u200c",
  zwj: "\u200d",
};

// Every codepoint any char signal can match — gates numeric-entity decoding.
const TYPOGRAPHIC_CODEPOINTS = new Set<number>([
  0x2010,
  0x2011,
  0x2012,
  0x2013,
  0x2014,
  0x2015,
  0x2212, // dashes
  0x00ab,
  0x00bb,
  0x2018,
  0x2019,
  0x201a,
  0x201b,
  0x201c,
  0x201d,
  0x201e,
  0x201f, // quotes
  0x00a0,
  0x1680,
  0x202f,
  0x205f,
  0x3000, // spaces (U+2000-U+200A range added below)
  0x00ad,
  0x061c,
  0x180e,
  0x200b,
  0x200c,
  0x200d,
  0x2060,
  0x2061,
  0x2062,
  0x2063,
  0x2064,
  0xfeff, // zero-width
  0x2026, // ellipsis
]);
for (let cp = 0x2000; cp <= 0x200a; cp++) TYPOGRAPHIC_CODEPOINTS.add(cp);

const RE_NAMED_ENTITY = /&([a-z][a-z0-9]*);/gi;
const RE_NUMERIC_ENTITY = /&#(x?)([0-9a-f]+);/gi;

/** Decode only the typographic entity subset; leave structural entities intact. */
function decodeTypographicEntities(input: string): string {
  let s = input.replace(RE_NAMED_ENTITY, (m, name: string) => {
    const decoded = NAMED_ENTITIES[name.toLowerCase()];
    return decoded ?? m;
  });
  s = s.replace(RE_NUMERIC_ENTITY, (m, hex: string, digits: string) => {
    const cp = parseInt(digits, hex ? 16 : 10);
    return TYPOGRAPHIC_CODEPOINTS.has(cp) ? String.fromCodePoint(cp) : m;
  });
  return s;
}

// ---------------------------------------------------------------------------
// normalizeText — plain text / char level
// ---------------------------------------------------------------------------

/** Normalize a plain-text string (also used for HTML text nodes and attr values). */
export function normalizeText(
  input: string,
  cfg: NormalizeConfig,
  opts?: NormalizeOptions,
): string {
  if (!cfg.enabled || !input) return input;
  let s = input;
  if (cfg.signals.htmlEntities) s = decodeTypographicEntities(s);
  s = applyCharSignals(s, cfg, opts);
  return s;
}

// ---------------------------------------------------------------------------
// normalizeHtml — tokenizer-based, escaping-safe
// ---------------------------------------------------------------------------

const HTML_SKIP_TAGS = new Set(["script", "style", "code", "pre", "kbd", "samp"]);
const ATTR_WHITELIST = ["alt", "title", "content", "aria-label", "aria-description", "placeholder"];
const RE_JSONLD_BLOCK =
  /(<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi;

function tagName(token: string): string {
  const m = token.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/);
  return m ? m[1].toLowerCase() : "";
}

/** Escape a normalized attribute value for the given quote delimiter. */
function escapeAttr(value: string, quote: '"' | "'"): string {
  // Only the delimiter needs escaping; we never introduce < or &.
  return quote === '"' ? value.replace(/"/g, "&quot;") : value.replace(/'/g, "&#39;");
}

function normalizeOpeningTagAttrs(
  tag: string,
  cfg: NormalizeConfig,
  opts?: NormalizeOptions,
): string {
  const re = new RegExp(`\\b(${ATTR_WHITELIST.join("|")})\\s*=\\s*("([^"]*)"|'([^']*)')`, "gi");
  return tag.replace(re, (_full, name: string, _q: string, dq?: string, sq?: string) => {
    const quote: '"' | "'" = dq !== undefined ? '"' : "'";
    const raw = dq !== undefined ? dq : (sq ?? "");
    const normalized = escapeAttr(normalizeText(raw, cfg, opts), quote);
    return `${name}=${quote}${normalized}${quote}`;
  });
}

/** Normalize an HTML string: text nodes, whitelisted attributes, and inline JSON-LD. */
export function normalizeHtml(
  input: string,
  cfg: NormalizeConfig,
  opts?: NormalizeOptions,
): string {
  if (!cfg.enabled || !input) return input;

  // 1. Inline JSON-LD: normalize string values via the JSON path (re-escapes safely).
  const html = input.replace(
    RE_JSONLD_BLOCK,
    (_full, open: string, body: string, close: string) => {
      return `${open}${normalizeJson(body, cfg, opts)}${close}`;
    },
  );

  // 2. Tokenize on tags; normalize text segments + whitelisted attributes.
  // Only match real HTML tags (starting with a letter, /, or !) — not stray <
  // in CSS like @media (width<=768px) which would swallow the </style> closer
  // and permanently trap the skip stack.
  const tokens = html.split(/(<[a-zA-Z/!][^>]*>)/);
  const skipStack: string[] = [];
  const out: string[] = [];

  for (const token of tokens) {
    if (token.startsWith("<")) {
      const isComment = token.startsWith("<!--");
      const isClosing = token.startsWith("</");
      const name = tagName(token);
      if (!isComment && !isClosing) {
        const inSkip = skipStack.length > 0;
        if (HTML_SKIP_TAGS.has(name)) skipStack.push(name);
        out.push(inSkip ? token : normalizeOpeningTagAttrs(token, cfg, opts));
        continue;
      }
      if (isClosing && skipStack[skipStack.length - 1] === name) skipStack.pop();
      out.push(token);
      continue;
    }
    out.push(skipStack.length > 0 ? token : normalizeText(token, cfg, opts));
  }
  return out.join("");
}

// ---------------------------------------------------------------------------
// normalizeJson — deep string-value normalize
// ---------------------------------------------------------------------------

function normalizeJsonValue(
  value: unknown,
  cfg: NormalizeConfig,
  state: { changed: boolean },
  opts?: NormalizeOptions,
): unknown {
  if (typeof value === "string") {
    const next = normalizeText(value, cfg, opts);
    if (next !== value) state.changed = true;
    return next;
  }
  if (Array.isArray(value)) {
    return value.map((v) => normalizeJsonValue(v, cfg, state, opts));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = normalizeJsonValue(v, cfg, state, opts); // keys left untouched
    }
    return out;
  }
  return value;
}

/** Normalize string VALUES in a JSON document. Returns the original text if nothing changed. */
export function normalizeJson(
  input: string,
  cfg: NormalizeConfig,
  opts?: NormalizeOptions,
): string {
  if (!cfg.enabled || !input.trim()) return input;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    // Not parseable as JSON — fall back to a text-safe normalize.
    return normalizeText(input, cfg, opts);
  }
  const state = { changed: false };
  const next = normalizeJsonValue(parsed, cfg, state, opts);
  if (!state.changed) return input; // preserve original formatting when clean
  return JSON.stringify(next, null, 2);
}

// ---------------------------------------------------------------------------
// normalizeXml — text content + CDATA (RSS, sitemap, SVG)
// ---------------------------------------------------------------------------

const RE_CDATA = /(<!\[CDATA\[)([\s\S]*?)(\]\]>)/g;

/** Normalize XML text content and CDATA. CDATA bodies are treated as HTML. */
export function normalizeXml(
  input: string,
  cfg: NormalizeConfig,
  opts?: NormalizeOptions,
): string {
  if (!cfg.enabled || !input) return input;

  // 1. CDATA blocks (RSS descriptions hold HTML) — normalize via the HTML path.
  const cdataParts: string[] = [];
  let xml = input.replace(RE_CDATA, (_full, open: string, body: string, close: string) => {
    cdataParts.push(`${open}${normalizeHtml(body, cfg, opts)}${close}`);
    return ` CDATA${cdataParts.length - 1} `;
  });

  // 2. Element text content (between tags). XML attributes rarely carry prose; skip them.
  // Only match real XML tags (starting with letter, /, or !) — not stray < in content.
  const tokens = xml.split(/(<[a-zA-Z/!][^>]*>)/);
  xml = tokens.map((t) => (t.startsWith("<") ? t : normalizeText(t, cfg, opts))).join("");

  // 3. Restore CDATA placeholders.
  xml = xml.replace(/ CDATA(\d+) /g, (_m, i: string) => cdataParts[Number(i)]);
  return xml;
}

// ---------------------------------------------------------------------------
// normalizeMarkdown — protect fenced + inline code
// ---------------------------------------------------------------------------

const RE_MD_CODE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;

/** Normalize Markdown prose while leaving fenced and inline code untouched. */
export function normalizeMarkdown(
  input: string,
  cfg: NormalizeConfig,
  opts?: NormalizeOptions,
): string {
  if (!cfg.enabled || !input) return input;
  // Capturing split keeps code spans at odd indices.
  const parts = input.split(RE_MD_CODE);
  return parts.map((part, i) => (i % 2 === 1 ? part : normalizeText(part, cfg, opts))).join("");
}

// ---------------------------------------------------------------------------
// Dispatch by kind (dist adapter) + residual detection (backstop)
// ---------------------------------------------------------------------------

export type NormalizableKind = "html" | "json" | "xml" | "svg" | "md" | "txt";

/** Map a file path to a normalizer kind, or null if it must not be touched. */
export function normalizeKindForPath(filePath: string): NormalizableKind | null {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".xml")) return "xml";
  if (lower.endsWith(".svg")) return "svg";
  if (lower.endsWith(".md")) return "md";
  if (lower.endsWith(".txt")) return "txt";
  return null;
}

/** Normalize a string given a normalizer kind. */
export function normalizeByKind(
  input: string,
  kind: NormalizableKind,
  cfg: NormalizeConfig,
  opts?: NormalizeOptions,
): string {
  switch (kind) {
    case "html":
      return normalizeHtml(input, cfg, opts);
    case "json":
      return normalizeJson(input, cfg, opts);
    case "xml":
    case "svg":
      return normalizeXml(input, cfg, opts);
    case "md":
      return normalizeMarkdown(input, cfg, opts);
    case "txt":
      return normalizeText(input, cfg, opts);
  }
}

export interface ResidualFinding {
  /** 1-based line number of the first residual occurrence. */
  line: number;
  /** Signal ids that still fire on the content. */
  signals: SignalId[];
}

/**
 * Backstop detection: would normalization still change this content? Reuses the
 * transforms so it inherits their skip rules (code/script/structural). Returns
 * null when clean. The per-signal set is computed by single-signal diffing.
 */
export function detectResidual(
  input: string,
  kind: NormalizableKind,
  cfg: NormalizeConfig,
  opts?: NormalizeOptions,
): ResidualFinding | null {
  if (!cfg.enabled) return null;
  const normalized = normalizeByKind(input, kind, cfg, opts);
  if (normalized === input) return null;

  const signals: SignalId[] = [];
  for (const id of SIGNAL_IDS) {
    if (!cfg.signals[id]) continue;
    const single: NormalizeConfig = { enabled: true, signals: {} as Record<SignalId, boolean> };
    for (const other of SIGNAL_IDS) single.signals[other] = other === id;
    if (normalizeByKind(input, kind, single, opts) !== input) signals.push(id);
  }

  const a = input.split("\n");
  const b = normalized.split("\n");
  let line = 1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      line = i + 1;
      break;
    }
  }
  return { line, signals };
}

/**
 * RFC-0569: Dev-only Astro middleware factory that applies egress text normalization
 * to HTML responses in dev mode. Gated by `import.meta.env.DEV` at the call site —
 * never executes in production builds. Reuses `normalizeHtml()` from this module,
 * ensuring dev/prod parity with the post-build dist sweep.
 *
 * Server-only. The caller loads the NormalizeConfig from `system.md` via
 * `loadSystemManifest()` from `@warpgogol/werkstatt-site/content` and passes it in.
 */
export function createDevNormalizeMiddleware(config: NormalizeConfig): MiddlewareHandler {
  return async (_context, next) => {
    const response = await next();
    if (!config.enabled) return response;
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("text/html")) return response;
    try {
      const body = await response.text();
      // RFC-1446: the rendered page declares its own locale — use it so the
      // dev path preserves orthographic apostrophes exactly like the dist sweep.
      const normalized = normalizeHtml(body, config, { locale: htmlLangOf(body) });
      return new Response(normalized, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[dev-normalize] normalizeHtml failed, returning original response:", err);
      }
      return response;
    }
  };
}
