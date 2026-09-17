/*
<MODULE_CONTRACT>
<purpose>Maintains packages/share/src/semantic/extract.ts as an authored share authored module so agents can evolve it without rediscovering local boundaries.</purpose>
<non-goals>
  <item>Do not introduce app-specific runtime composition or deployment behavior into this reusable package source file.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0133: backfilled MODULE_MAP and CHANGE_SUMMARY markers for compass.validate compliance.</item>
  <item>RFC-0915: removed custom slugify() — replaced by slugId from @warpgogol/werkstatt-shared/share/slug.</item>
</CHANGE_SUMMARY>
*/

import type { SemanticPerson, SemanticPostalAddress } from "./models.ts";

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export type MarkdownSection = {
  heading: string;
  body: string;
};

export function splitMarkdownSections(markdown: string, level: 2 | 3 = 2): MarkdownSection[] {
  const normalizedMarkdown = markdown.trim();
  if (!normalizedMarkdown) {
    return [];
  }

  const marker = "#".repeat(level);
  const splitPattern = new RegExp(`\\n(?=${marker}\\s+)`);
  const headingPattern = new RegExp(`^${marker}\\s+`);

  return normalizedMarkdown
    .split(splitPattern)
    .map((section) => section.trim())
    .filter((section) => headingPattern.test(section))
    .map((section) => {
      const [headingLine = "", ...restLines] = section.split("\n");
      return {
        heading: headingLine.replace(headingPattern, "").trim(),
        body: restLines.join("\n").trim(),
      };
    });
}

export function extractParagraphs(markdown: string): string[] {
  return markdown
    .split(/\n\s*\n/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
}

const SENTENCE_ABBREVIATIONS: Record<string, string[]> = {
  de: [
    "z.B.",
    "z. B.",
    "z.",
    "etc.",
    "Nr.",
    "Abs.",
    "§",
    "S.",
    "ca.",
    "u.a.",
    "u. a.",
    "u.",
    "vgl.",
    "bspw.",
    "zzgl.",
    "inkl.",
    "exkl.",
    "bzw.",
    "ggf.",
    "ggfls.",
    "sog.",
    "o.Ä.",
  ],
  uk: [
    "т.д.",
    "т.п.",
    "п.",
    "ст.",
    "див.",
    "пор.",
    "напр.",
    "ім.",
    "о.",
    "вкл.",
    "тис.",
    "млн.",
    "млрд.",
    "грн.",
    "№",
  ],
  en: ["e.g.", "i.e.", "etc.", "vs.", "Mr.", "Mrs.", "Dr.", "Inc.", "Ltd."],
};

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildAbbreviationPattern(abbreviations: string[]): RegExp | undefined {
  if (abbreviations.length === 0) return undefined;
  const sorted = [...abbreviations].sort((a, b) => b.length - a.length);
  return new RegExp(`(?:^|[^a-zA-Zа-яА-ЯёЁїЇіІєЄäöüÄÖÜß])(${sorted.map(escapeRegex).join("|")})$`);
}

export function splitSentences(text: string, locale: string = "en"): string[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const abbreviations = SENTENCE_ABBREVIATIONS[locale] ?? SENTENCE_ABBREVIATIONS.en;
  const abbrevPattern = buildAbbreviationPattern(abbreviations);

  const sentences: string[] = [];
  let current = "";

  const chars = [...normalized];
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    current += char;

    if (char !== "." && char !== "!" && char !== "?") continue;

    const nextChar = chars[i + 1];
    if (nextChar === undefined) {
      sentences.push(current.trim());
      current = "";
      continue;
    }

    if (nextChar !== " " && nextChar !== "\n" && nextChar !== "\t") continue;

    const beforeAbbrCheck = current.trimEnd();

    if (abbrevPattern && abbrevPattern.test(beforeAbbrCheck)) continue;

    // Skip numbered list markers (e.g., "1. ", "2. ") — a period after
    // digits is a list marker, not a sentence boundary. After normalizeWhitespace
    // newlines are spaces, so we check the token before the period.
    const beforePeriod = current.slice(0, -1);
    const lastSpaceIdx = Math.max(beforePeriod.lastIndexOf(" "), beforePeriod.lastIndexOf("\n"));
    const tokenBeforePeriod = beforePeriod.slice(lastSpaceIdx + 1).trim();
    if (/^\d+$/.test(tokenBeforePeriod)) continue;

    const afterWhitespace = chars
      .slice(i + 1)
      .join("")
      .match(/^\s*([A-ZÄÖÜА-ЯЁЇІЄ])/);
    if (!afterWhitespace) continue;

    sentences.push(current.trim());
    current = "";
  }

  if (current.trim()) sentences.push(current.trim());

  return sentences.filter(Boolean);
}

export type MarkdownList = {
  marker: "-" | "*" | "+" | "digit";
  items: string[];
};

const LIST_MARKER_PATTERNS: Array<{ marker: MarkdownList["marker"]; regex: RegExp }> = [
  { marker: "-", regex: /^-\s+/ },
  { marker: "*", regex: /^\*\s+/ },
  { marker: "+", regex: /^\+\s+/ },
  { marker: "digit", regex: /^\d+\.\s+/ },
];

function matchListMarker(
  line: string,
): { marker: MarkdownList["marker"]; text: string } | undefined {
  for (const { marker, regex } of LIST_MARKER_PATTERNS) {
    const match = line.match(regex);
    if (match) {
      return { marker, text: line.slice(match[0].length).trim() };
    }
  }
  return undefined;
}

function isTopLevelListLine(
  line: string,
): { marker: MarkdownList["marker"]; text: string } | undefined {
  // Top-level: no leading whitespace before the marker
  if (/^\s/.test(line)) return undefined;
  return matchListMarker(line);
}

function isIndentedListLine(line: string): boolean {
  // Indented list line: starts with whitespace + list marker
  if (!/^\s/.test(line)) return false;
  const trimmed = line.trimStart();
  return LIST_MARKER_PATTERNS.some(({ regex }) => regex.test(trimmed));
}

export function extractLists(markdown: string): MarkdownList[] {
  const normalized = markdown.trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const lists: MarkdownList[] = [];
  let currentList: MarkdownList | null = null;
  let inCodeFence = false;

  for (const line of lines) {
    // Track fenced code blocks
    if (line.trimStart().startsWith("```")) {
      inCodeFence = !inCodeFence;
      if (currentList) {
        lists.push(currentList);
        currentList = null;
      }
      continue;
    }

    if (inCodeFence) {
      continue;
    }

    const topMatch = isTopLevelListLine(line);

    if (topMatch) {
      // Continue current list if same marker type
      if (currentList && currentList.marker === topMatch.marker) {
        currentList.items.push(topMatch.text);
      } else {
        // Different marker or first list — flush previous, start new
        if (currentList) {
          lists.push(currentList);
        }
        currentList = { marker: topMatch.marker, items: [topMatch.text] };
      }
      continue;
    }

    // Indented list line — part of parent item, not a new item
    if (isIndentedListLine(line)) {
      continue;
    }

    // Non-list line (blank, prose, heading, etc.) — terminate current list
    if (currentList) {
      lists.push(currentList);
      currentList = null;
    }
  }

  // Flush trailing list
  if (currentList) {
    lists.push(currentList);
  }

  return lists;
}

export function extractListFacts(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") || /^\d+\.\s+/.test(line))
    .map((line) =>
      line
        .replace(/^-\s+/, "")
        .replace(/^\d+\.\s+/, "")
        .trim(),
    )
    .filter(Boolean);
}

export function extractEmail(markdown: string): string | undefined {
  const match = markdown.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0];
}

export function extractPostalAddress(
  markdown: string,
  country: string = "DE",
): SemanticPostalAddress | undefined {
  const match = markdown.match(/([^\n,]+),\s*(\d{5})\s+([^\n]+)/);

  if (!match) {
    return undefined;
  }

  return {
    streetAddress: match[1].trim(),
    postalCode: match[2].trim(),
    addressLocality: match[3].trim(),
    addressCountry: country,
  };
}

export function mergePeople(...groups: Array<SemanticPerson[] | undefined>): SemanticPerson[] {
  const merged = new Map<string, SemanticPerson>();

  for (const group of groups) {
    for (const person of group ?? []) {
      const existing = merged.get(person.name);
      merged.set(person.name, {
        name: person.name,
        role: existing?.role ?? person.role,
        description: existing?.description ?? person.description,
        isDeceased: existing?.isDeceased || person.isDeceased,
      });
    }
  }

  return Array.from(merged.values());
}
