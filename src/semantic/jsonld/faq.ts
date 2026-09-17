/*
<MODULE_CONTRACT>
<purpose>Maintains packages/share/src/semantic/jsonld/faq.ts as an authored share authored module so agents can evolve it without rediscovering local boundaries.</purpose>
<non-goals>
  <item>Do not validate FAQ input data.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

import type { JsonLdContext } from "./context.ts";
import type { JsonLdNode } from "./types.ts";
import type { SemanticFaqEntry } from "../models.ts";

function buildQuestionNode(entry: SemanticFaqEntry): JsonLdNode {
  return {
    "@type": "Question",
    name: entry.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: entry.answer,
    },
  };
}

export function buildFaqPageNode(context: JsonLdContext): JsonLdNode | null {
  const entries = context.page.faqEntries;
  if (!entries || entries.length === 0) {
    return null;
  }

  return {
    "@type": "FAQPage",
    "@id": context.faqPageId,
    mainEntity: entries.map((entry) => buildQuestionNode(entry)),
  };
}

export function buildFaqNodes(context: JsonLdContext): JsonLdNode[] {
  // RFC-0506: suppress FAQPage on ratgeber depth-1 article pages.
  if (context.page.surfaceId === "ratgeber" && context.page.depth === 1) {
    return [];
  }
  const faqPage = buildFaqPageNode(context);
  return faqPage ? [faqPage] : [];
}
