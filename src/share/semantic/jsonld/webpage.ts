/*
<MODULE_CONTRACT>
<purpose>Maintains packages/share/src/semantic/jsonld/webpage.ts as an authored share authored module so agents can evolve it without rediscovering local boundaries.</purpose>
<non-goals>
  <item>Do not parse raw content.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0372: speakable reads from unified page.blocks instead of answerBlocks.</item>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

import type { JsonLdContext } from "./context.ts";
import type { SemanticPageModel } from "../models.ts";
import type { JsonLdNode } from "./types.ts";

function getWebPageTypes(page: SemanticPageModel): string[] {
  switch (page.type) {
    case "about":
      return ["WebPage", "AboutPage"];
    case "projects":
      return ["WebPage", "CollectionPage"];
    case "openSource":
      return ["WebPage", "CollectionPage"];
    case "donationContact":
      return ["WebPage", "ContactPage"];
    case "person":
      // RFC-0200: a per-member profile page is a schema.org ProfilePage.
      return ["WebPage", "ProfilePage"];
    case "collection":
      // RFC-0490: a pillar hub page is a schema.org CollectionPage.
      return ["WebPage", "CollectionPage"];
    default:
      return ["WebPage"];
  }
}

export function buildWebPageNode(context: JsonLdContext): JsonLdNode {
  const { page, ids, webpageId, breadcrumbId, initiativesListId, servicesListId } = context;

  return {
    "@type": getWebPageTypes(page),
    "@id": webpageId,
    url: page.url,
    name: page.title,
    headline: page.heading ?? page.title,
    description: page.description,
    inLanguage: page.lang,
    isPartOf: { "@id": ids.website },
    about: { "@id": ids.organization },
    publisher: { "@id": ids.organization },
    ...(page.type === "about" ? { mainEntity: { "@id": ids.organization } } : {}),
    ...(page.type === "projects" && page.initiatives?.length
      ? { mainEntity: { "@id": initiativesListId } }
      : {}),
    // RFC-0200: a profile page's subject is the profiled Person (attached to page.people).
    // RFC-0512: for team profile pages, prefer the extended Person/SoftwareApplication node
    // from extraGraphNodes as mainEntity — this covers AI-agent profiles (where page.people
    // is empty) and human profiles (where the extended Person node has a different @id).
    ...(page.type === "person" && page.extraGraphNodes?.[0]
      ? { mainEntity: { "@id": page.extraGraphNodes[0]["@id"] } }
      : page.type === "person" && page.people?.[0]
        ? { mainEntity: { "@id": ids.person(page.people[0].name) } }
        : {}),
    ...(page.organization.services?.length && servicesListId
      ? { mentions: { "@id": servicesListId } }
      : {}),
    ...(page.breadcrumbs.length > 1 ? { breadcrumb: { "@id": breadcrumbId } } : {}),
    ...(page.lead ? { abstract: page.lead } : {}),
    // RFC-0163: primary image of the page (consumed from RFC-0162 primaryImage).
    ...(page.primaryImage
      ? {
          primaryImageOfPage: {
            "@type": "ImageObject",
            url: page.primaryImage.url,
            ...(page.primaryImage.width ? { width: page.primaryImage.width } : {}),
            ...(page.primaryImage.height ? { height: page.primaryImage.height } : {}),
          },
        }
      : {}),
    // RFC-0227: link credited materials from the page entity for licensable-images treatment.
    ...(page.materialCreditAtIds?.length
      ? { associatedMedia: page.materialCreditAtIds.map((id) => ({ "@id": id })) }
      : {}),
    // RFC-0163: speakable answer surface for voice assistants / AI Overviews. The
    // page heading and lead are always-present, extractable answer anchors.
    // RFC-0372: reads from unified page.blocks (any block with a heading counts as speakable).
    ...(page.blocks.some((b) => b.heading)
      ? {
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: page.lead ? ["h1", ".section-header__subheading"] : ["h1"],
          },
        }
      : {}),
  };
}
