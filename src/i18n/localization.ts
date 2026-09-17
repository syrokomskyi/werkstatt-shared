/*
<MODULE_CONTRACT>
<purpose>
App-agnostic i18n helpers: a factory that creates type-safe localization utilities
bound to any language mapping. Each app supplies its own mapping constant; this module
provides the reusable logic without hard-coding any language list.
</purpose>
<non-goals>
  <item>Do not hard-code any language list — each app owns its own LANGUAGE_MAPPING constant.</item>
  <item>Do not import from apps/* or astro:content.</item>
  <item>Do not manage language preferences, user sessions, or UI rendering.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

// [DNA-02][DNA-10] App-agnostic localization utilities.
// Each app calls createLocalizationHelpers(LANGUAGE_MAPPING) to get type-safe i18n helpers
// bound to its own language list.

export function createLocalizationHelpers<TMapping extends Record<string, string>>(
  languageMapping: TMapping,
) {
  type SupportedLanguage = keyof TMapping & string;

  function isLanguageCode(code: string): code is SupportedLanguage {
    return code in languageMapping;
  }

  function getSupportedLanguageCodes(): SupportedLanguage[] {
    return Object.keys(languageMapping) as SupportedLanguage[];
  }

  function getLocalizedUrl(currentPath: string, targetLang: string): string {
    const cleanPath = currentPath.startsWith("/") ? currentPath.slice(1) : currentPath;

    if (!cleanPath) {
      return `/${targetLang}/`;
    }

    const parts = cleanPath.split("/");

    // If the first segment is an existing language code, replace it.
    if (parts[0] && parts[0] in languageMapping) {
      parts[0] = targetLang;
      return `/${parts.join("/")}`;
    }

    // Otherwise, prepend the target language.
    return `/${targetLang}/${cleanPath}`;
  }

  return { isLanguageCode, getSupportedLanguageCodes, getLocalizedUrl } as const;
}
