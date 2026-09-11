/*
<MODULE_CONTRACT>
<purpose>Text-surface extractor for the typography rule engine (RFC-1068).
Extracts scannable text segments from Markdown frontmatter strings and body
lines, applying a normative stripping order so rules see clean text without
code blocks, HTML tags, formulas, or URLs. Also catches YAML frontmatter
parse errors and maps them to a structured yamlError field.</purpose>
<non-goals>
  <item>Do not implement typography rules — that is rules-tier1.ts.</item>
  <item>Do not read files or perform I/O — the caller passes source text.</item>
  <item>Do not validate content semantics — only extracts text for rule scanning.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1068: initial creation.</item>
</CHANGE_SUMMARY>
*/

import YAML from "yaml";
import { parseMarkdownFrontmatter } from "../../content/markdown-frontmatter.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TextSegmentSource = "frontmatter" | "body";

export interface TextSegment {
  /** Repo-relative file path. */
  file: string;
  /** 1-based file line of the segment start (frontmatter offset already applied). */
  line: number;
  /** JSON-path for frontmatter strings (`$.blocks[2].props.items[0].text`), `$body` for body lines. */
  path: string;
  source: TextSegmentSource;
  /** Segment text after stripping; this is what rules see. */
  text: string;
  /** Original text before stripping; used for fix (RFC-1072) and messages. */
  raw: string;
  /** True when the segment is a markdown table row (some rules skip these). */
  isTableRow: boolean;
  locale: string;
}

export interface TextSurfaceOptions {
  /** Keys whose values are never text (default: TECHNICAL_KEYS). */
  skipKeys?: ReadonlySet<string>;
  /** Site i18n languages; used to derive file locale. */
  languages: readonly string[];
  defaultLanguage: string;
}

export interface YamlError {
  line: number;
  column: number;
  message: string;
}

export interface ExtractTextSurfaceResult {
  segments: TextSegment[];
  yamlError: YamlError | null;
}

// ---------------------------------------------------------------------------
// Technical keys — values under these keys are never treated as text
// ---------------------------------------------------------------------------

export const TECHNICAL_KEYS = new Set([
  "id",
  "slug",
  "href",
  "url",
  "src",
  "path",
  "type",
  "use",
  "kind",
  "variant",
  "layout",
  "anchorId",
  "blockId",
  "ref",
  "key",
  "vendor",
  "collection",
  "lang",
  "locale",
  "currency",
  "email",
  "phone",
]);

// When the parent key is "icon", the child "name" is technical
const TECHNICAL_PARENT_CHILD: Record<string, Set<string>> = {
  icon: new Set(["name"]),
};

// ---------------------------------------------------------------------------
// Identifier heuristic — values without whitespace that contain /, _, or .
// and no letter-space-letter sequence are treated as identifiers and skipped
// ---------------------------------------------------------------------------

const IDENTIFIER_REGEX = /^[^\s]+$/;
const HAS_SLASH_OR_UNDERSCORE_OR_DOT = /[/_\.]/;
const LETTER_SPACE_LETTER = /\p{L}\s\p{L}/u;

function isIdentifierValue(value: string): boolean {
  if (!IDENTIFIER_REGEX.test(value)) return false;
  if (!HAS_SLASH_OR_UNDERSCORE_OR_DOT.test(value)) return false;
  if (LETTER_SPACE_LETTER.test(value)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// File locale derivation
// ---------------------------------------------------------------------------

export function deriveFileLocale(
  file: string,
  languages: readonly string[],
  defaultLanguage: string,
): string {
  // file is repo-relative: may be src/content/<collection>/<lang>/... or
  // missions/<id>/workpiece/src/content/<collection>/<lang>/...
  const parts = file.split("/");
  const srcIdx = parts.indexOf("src");
  if (srcIdx >= 0 && srcIdx + 3 < parts.length && parts[srcIdx + 1] === "content") {
    const lang = parts[srcIdx + 3];
    if (languages.includes(lang)) return lang;
  }
  return defaultLanguage;
}

// ---------------------------------------------------------------------------
// Frontmatter string extraction
// ---------------------------------------------------------------------------

interface FrontmatterStringEntry {
  path: string;
  value: string;
  /** 1-based line within the frontmatter block (relative to frontmatter start). */
  lineInFrontmatter: number;
}

function extractFrontmatterStrings(
  data: unknown,
  parentKey: string | null,
  skipKeys: ReadonlySet<string>,
  lineCounter: YAML.LineCounter | null,
  frontmatterText: string,
): FrontmatterStringEntry[] {
  const results: FrontmatterStringEntry[] = [];

  function walk(value: unknown, currentPath: string, parent: string | null): void {
    if (typeof value === "string") {
      // Check if this key is technical
      const lastKey = currentPath.split(".").pop() ?? currentPath;
      const isTechnical =
        skipKeys.has(lastKey) ||
        (parent !== null && TECHNICAL_PARENT_CHILD[parent]?.has(lastKey) === true);
      if (isTechnical) return;
      if (isIdentifierValue(value)) return;

      // Derive line from lineCounter if available
      let lineInFrontmatter = 0;
      if (lineCounter) {
        const range = lineCounter.lineStarts;
        // Find the position of this value in the source — we approximate by
        // searching for the value in the frontmatter text
        const valueIndex = frontmatterText.indexOf(value);
        if (valueIndex >= 0) {
          lineInFrontmatter = range.findIndex((start, i) => {
            const nextStart = range[i + 1] ?? frontmatterText.length + 1;
            return valueIndex >= start && valueIndex < nextStart;
          });
          if (lineInFrontmatter < 0) lineInFrontmatter = 0;
          lineInFrontmatter += 1; // 1-based
        }
      }

      results.push({ path: currentPath, value, lineInFrontmatter });
      return;
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        walk(value[i], `${currentPath}[${i}]`, parent);
      }
      return;
    }

    if (value !== null && typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const newParent = key;
        // Check if this key itself is technical (skip entire subtree)
        if (skipKeys.has(key)) continue;
        if (parent !== null && TECHNICAL_PARENT_CHILD[parent]?.has(key) === true) continue;
        walk(child, currentPath === "$" ? `$.${key}` : `${currentPath}.${key}`, newParent);
      }
      return;
    }
  }

  walk(data, "$", parentKey);
  return results;
}

// ---------------------------------------------------------------------------
// Body text extraction with normative stripping order
// ---------------------------------------------------------------------------

// (1) Fenced code blocks
const FENCED_CODE = /```[\s\S]*?```/g;
// (1) Inline code spans
const INLINE_CODE = /`[^`]*`/g;
// (2) HTML comments
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
// (3) Void HTML elements
const VOID_HTML =
  /<(?:br|hr|img|input|meta|link|source|area|base|col|embed|param|track|wbr)\b[^>]*\/?>/giu;
// (3) Non-void HTML elements — strip tags, keep text
const NON_VOID_HTML = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/gu;
const VOID_ELEMENTS = new Set([
  "br",
  "hr",
  "img",
  "input",
  "meta",
  "link",
  "source",
  "area",
  "base",
  "col",
  "embed",
  "param",
  "track",
  "wbr",
]);
// (4) Formula expressions =(…)
const FORMULA = /=\([^)]*\)/g;
// (5) Markdown link/image targets — keep link text, remove ](…)
const LINK_TARGET = /\]\([^)]*\)/g;
// (6) URL, e-mail, domain tokens
const URL_PATTERN = /https?:\/\/[^\s)]+/gi;
const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.\w{2,}/gi;
const DOMAIN_PATTERN = /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/gi;

function stripBodyLine(line: string): string {
  let result = line;

  // (1) Remove fenced code blocks (they span multiple lines, but for per-line
  // processing we rely on the caller to skip fenced blocks entirely)
  result = result.replace(INLINE_CODE, "");

  // (2) Remove HTML comments
  result = result.replace(HTML_COMMENT, "");

  // (3) Strip inline HTML tags
  result = result.replace(VOID_HTML, "");
  result = result.replace(NON_VOID_HTML, (match, tagName) => {
    if (VOID_ELEMENTS.has(String(tagName).toLowerCase())) return "";
    // Non-void: keep text content (the match is just the tag, not content)
    return "";
  });

  // (4) Replace formulas with placeholder
  result = result.replace(FORMULA, "\uE000");

  // (4b) Remove CMS template expressions ({price:...}, {t:...}, etc.)
  result = result.replace(/\{[^}]*\}/g, "");

  // (5) Remove markdown link targets, keep link text
  result = result.replace(LINK_TARGET, "");

  // (6) Replace URLs, e-mails, domains with placeholder
  result = result.replace(URL_PATTERN, "\uE001");
  result = result.replace(EMAIL_PATTERN, "\uE001");
  result = result.replace(DOMAIN_PATTERN, "\uE001");

  return result;
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

export function extractTextSurface(
  file: string,
  source: string,
  options: TextSurfaceOptions,
): ExtractTextSurfaceResult {
  const skipKeys = options.skipKeys ?? TECHNICAL_KEYS;
  const locale = deriveFileLocale(file, options.languages, options.defaultLanguage);

  // Parse frontmatter — catch YAML errors
  const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatterText = frontmatterMatch?.[1] ?? "";
  const frontmatterLineCount = frontmatterMatch ? frontmatterMatch[0].split(/\r?\n/).length : 0;

  let data: Record<string, unknown> = {};
  let yamlError: YamlError | null = null;

  try {
    const parsed = parseMarkdownFrontmatter(source);
    data = parsed.data;
  } catch (err) {
    // YAML parse error — extract line/column from YAMLParseError
    if (err instanceof YAML.YAMLParseError) {
      const linePos = (err as unknown as { linePos?: Array<{ line: number; col: number }> })
        .linePos;
      const line = linePos?.[0]?.line ?? 0;
      const column = linePos?.[0]?.col ?? 0;
      yamlError = { line, column, message: err.message };
    } else {
      yamlError = { line: 0, column: 0, message: err instanceof Error ? err.message : String(err) };
    }
  }

  const segments: TextSegment[] = [];

  // Extract frontmatter strings
  if (Object.keys(data).length > 0 && !yamlError) {
    let lineCounter: YAML.LineCounter | null = null;
    try {
      lineCounter = new YAML.LineCounter();
      YAML.parseDocument(frontmatterText, { lineCounter });
    } catch {
      lineCounter = null;
    }

    const fmStrings = extractFrontmatterStrings(data, null, skipKeys, lineCounter, frontmatterText);

    for (const entry of fmStrings) {
      const stripped = stripBodyLine(entry.value);
      if (stripped.trim().length === 0) continue;
      segments.push({
        file,
        line: entry.lineInFrontmatter + 1, // +1 because frontmatter starts at line 2 (after ---)
        path: entry.path,
        source: "frontmatter",
        text: stripped,
        raw: entry.value,
        isTableRow: false,
        locale,
      });
    }
  }

  // Extract body lines
  const body = frontmatterMatch ? source.slice(frontmatterMatch[0].length) : source;
  const bodyLines = body.split(/\r?\n/);
  const bodyLineOffset = frontmatterLineCount;

  let inFencedBlock = false;

  for (let i = 0; i < bodyLines.length; i += 1) {
    const rawLine = bodyLines[i];
    const lineNum = i + 1 + bodyLineOffset;

    // Track fenced code blocks
    if (/^```/.test(rawLine.trim())) {
      inFencedBlock = !inFencedBlock;
      continue;
    }
    if (inFencedBlock) continue;

    // Skip empty lines
    if (rawLine.trim().length === 0) continue;

    const isTableRow = /^\|.*\|/.test(rawLine.trim());
    const stripped = stripBodyLine(rawLine);

    if (stripped.trim().length === 0) continue;

    segments.push({
      file,
      line: lineNum,
      path: "$body",
      source: "body",
      text: stripped,
      raw: rawLine,
      isTableRow,
      locale,
    });
  }

  return { segments, yamlError };
}
