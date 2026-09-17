/*
<MODULE_CONTRACT>
<purpose>Maintains packages/share/src/semantic/jsonld/initiative.ts as an authored share authored module so agents can evolve it without rediscovering local boundaries.</purpose>
<non-goals>
  <item>Do not validate initiative input data.</item>
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

function buildInitiativeNode(
  context: JsonLdContext,
  initiative: { name: string; summary: string },
): JsonLdNode {
  const { ids } = context;

  return {
    "@type": ["Thing", "Project"],
    "@id": ids.initiative(initiative.name),
    name: initiative.name,
    description: initiative.summary,
  };
}

export function buildInitiativeNodes(context: JsonLdContext): JsonLdNode[] {
  return (context.page.initiatives ?? []).map((initiative) =>
    buildInitiativeNode(context, initiative),
  );
}

export function buildInitiativesListNode(context: JsonLdContext): JsonLdNode | null {
  const { page, ids, initiativesListId } = context;

  if (!page.initiatives?.length) {
    return null;
  }

  return {
    "@type": "ItemList",
    "@id": initiativesListId,
    itemListElement: page.initiatives.map((initiative, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: { "@id": ids.initiative(initiative.name) },
      name: initiative.name,
    })),
  };
}
