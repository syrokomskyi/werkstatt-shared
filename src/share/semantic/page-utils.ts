/*
<MODULE_CONTRACT>
<purpose>Shared utilities for semantic page builders: slug generation, markdown answer block extraction, and conversion helpers.</purpose>
<non-goals>
  <item>Do not contain page-specific logic or component content loading.</item>
  <item>Do not interact with astro:content — use astro/semantic-page.ts for that.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0372: toSemanticAnswerBlocks now returns SemanticBlock[] with blockType: "prose".</item>
  <item>RFC-0915: replaced slugify import from extract.ts with slugId from canonical slug module.</item>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

import type { SemanticBlock } from "./models.ts";
import { slugId } from "../slug/index.ts";

/**
 * Extracts structured answer blocks from markdown body text.
 * Looks for h2 headings (## ...) and captures content until the next h2 or end of document.
 */
export function extractAnswerBlocksFromMarkdown(
  bodyText: string,
): Array<{ heading: string; content: string }> {
  const blocks: Array<{ heading: string; content: string }> = [];
  const lines = bodyText.split("\n");
  let currentHeading = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      if (currentHeading && currentContent.length > 0) {
        blocks.push({
          heading: currentHeading,
          content: currentContent.join("\n").trim(),
        });
      }
      currentHeading = h2Match[1];
      currentContent = [];
    } else if (currentHeading) {
      currentContent.push(line);
    }
  }

  if (currentHeading && currentContent.length > 0) {
    blocks.push({
      heading: currentHeading,
      content: currentContent.join("\n").trim(),
    });
  }

  return blocks;
}

/**
 * Converts structured answer blocks back to markdown format.
 */
export function blocksToMarkdown(blocks: Array<{ heading: string; content: string }>): string {
  return blocks
    .map((block) => `## ${block.heading}\n\n${block.content}`)
    .join("\n\n")
    .trim();
}

/**
 * Generates a page entry ID from a URL path.
 * Removes language prefix and .html extension, then converts to kebab-case.
 */
export function toPageEntryId(url: URL): string {
  const pathname = url.pathname;
  const withoutLang = pathname.replace(/^\/[a-z]{2}\//, "/");
  const clean = withoutLang.replace(/^\//, "").replace(/\.html$/, "");
  return clean.replace(/\//g, "-") || "index";
}

/**
 * RFC-0372: Transforms markdown answer blocks to SemanticBlock[] with blockType: "prose".
 * Adds id, summary, and facts fields according to SemanticBlock type.
 */
export function toSemanticAnswerBlocks(
  blocks: Array<{ heading: string; content: string }>,
): SemanticBlock[] {
  return blocks.map((block) => {
    // A GFM table or a section with more than one paragraph carries structure that a flat
    // one-line-per-fact split would destroy (table rows becoming stray bullets, an unrelated
    // closing paragraph merging into the fact list). Preserve that content verbatim as the
    // block summary instead of fragmenting it.
    const hasTable = /^\s*\|/m.test(block.content);
    const hasMultipleParagraphs = /\n[ \t]*\n/.test(block.content.trim());
    if (hasTable || hasMultipleParagraphs) {
      return {
        id: slugId(block.heading),
        blockType: "prose",
        heading: block.heading,
        summary: block.content.trim(),
        facts: undefined,
      };
    }

    const lines = block.content.split("\n").filter((line) => line.trim());
    const firstLine = lines[0] || "";
    const remainingLines = lines.slice(1);

    const isSummary =
      !firstLine.startsWith("-") && !firstLine.startsWith("*") && !firstLine.startsWith("#");

    return {
      id: slugId(block.heading),
      blockType: "prose",
      heading: block.heading,
      summary: isSummary ? firstLine : undefined,
      facts: isSummary ? remainingLines : lines,
    };
  });
}
