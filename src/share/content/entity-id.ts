/*
<MODULE_CONTRACT>
<purpose>
App-agnostic utility functions for normalizing Astro content entry IDs and extracting
language codes from them. Shared across all apps in apps/*; no app-specific imports allowed.
</purpose>
<non-goals>
  <item>Do not import from apps/* or astro:content.</item>
  <item>Do not perform schema validation or runtime data fetching.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into <history>, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
</CHANGE_SUMMARY>
*/

// Shared entity-ID normalization for all schema dispatchers.
// Source: app content schemas/entity-id (migrated to packages/share).

export function toDataEntryId(entry: string): string {
  return entry.replace(/\\/g, "/").replace(/\.md$/i, "");
}

export function getEntryLanguage(id: string): string | null {
  const [firstSegment] = toDataEntryId(id).split("/");

  if (!firstSegment || !/^[a-z]{2}$/i.test(firstSegment)) {
    return null;
  }

  return firstSegment;
}

export function stripEntryLanguage(id: string): string {
  const normalizedId = toDataEntryId(id);
  const entryLanguage = getEntryLanguage(normalizedId);

  if (!entryLanguage) {
    return normalizedId;
  }

  return normalizedId.slice(entryLanguage.length + 1);
}

export function pageIdToContentFileSlug(pageId: string): string {
  return pageId
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Creates a schema lookup function keyed by normalized entry ID.
 */
export function createDispatcherResolver<T = unknown>(schemaMap: Record<string, T>) {
  return (entryId: string): T | undefined => {
    const schemaId = stripEntryLanguage(toDataEntryId(entryId));
    if (!(schemaId in schemaMap)) {
      return undefined;
    }
    return schemaMap[schemaId];
  };
}
