/*
<MODULE_CONTRACT>
<purpose>Maintains packages/share/src/semantic/jsonld/breadcrumb.ts as an authored share authored module so agents can evolve it without rediscovering local boundaries.</purpose>
<non-goals>
  <item>Do not parse raw content.</item>
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

export function buildBreadcrumbNode(context: JsonLdContext): JsonLdNode | null {
  const { page, breadcrumbId } = context;

  if (page.breadcrumbs.length <= 1) {
    return null;
  }

  // RFC-0229: trail crumbs carry root-relative paths so the *rendered* links work in any environment.
  // The BreadcrumbList `item` must be an absolute canonical URL, so resolve each crumb against the
  // page's canonical origin (already-absolute crumb URLs pass through unchanged).
  const toAbsolute = (url: string): string => {
    try {
      return new URL(url, page.url).toString();
    } catch {
      return url;
    }
  };

  return {
    "@type": "BreadcrumbList",
    "@id": breadcrumbId,
    itemListElement: page.breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      // RFC-0229: stable, position-scoped @id so each crumb is an addressable node in the page graph.
      "@id": `${breadcrumbId}/${index + 1}`,
      position: index + 1,
      name: item.name,
      item: toAbsolute(item.url),
    })),
  };
}
