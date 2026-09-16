/*
<MODULE_CONTRACT>
<purpose>Maintains packages/share/src/semantic/jsonld/website.ts as an authored share authored module so agents can evolve it without rediscovering local boundaries.</purpose>
<non-goals>
  <item>Do not parse raw content.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into <history>, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
</CHANGE_SUMMARY>
*/

import type { JsonLdContext } from "./context.ts";
import type { JsonLdNode } from "./types.ts";

export function buildWebSiteNode(context: JsonLdContext): JsonLdNode {
  const { page, ids } = context;

  return {
    "@type": "WebSite",
    "@id": ids.website,
    url: page.organization.url,
    name: page.organization.name,
    inLanguage: page.lang,
    publisher: { "@id": ids.organization },
  };
}
