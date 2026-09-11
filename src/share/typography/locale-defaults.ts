/*
<MODULE_CONTRACT>
<purpose>Locale-specific typography defaults for the typography rule engine.
Exports abbreviation sets and foreign-alphabet letter sets keyed by locale code
(RFC-1068).</purpose>
<non-goals>
  <item>Do not define typography rules — only locale-specific data.</item>
  <item>Do not read system.md or site configuration.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1068: initial creation with de, uk, en abbreviation sets.</item>
</CHANGE_SUMMARY>
*/

export interface LocaleTypographyDefaults {
  /** Abbreviations ending with a period, used for TYPO-CASE-02 exclusion. */
  abbreviations: ReadonlySet<string>;
}

const DE_ABBREVIATIONS = new Set([
  "z. B.",
  "u. a.",
  "d. h.",
  "bzw.",
  "ca.",
  "inkl.",
  "exkl.",
  "ggf.",
  "evtl.",
  "vgl.",
  "usw.",
  "etc.",
  "Nr.",
  "Abs.",
  "Std.",
  "Min.",
  "Str.",
]);

const UK_ABBREVIATIONS = new Set([
  "напр.",
  "тис.",
  "грн",
  "т. ч.",
  "ст.",
  "п.",
  "р.",
  "див.",
]);

const EN_ABBREVIATIONS = new Set([
  "e.g.",
  "i.e.",
  "etc.",
  "vs.",
  "No.",
]);

export const LOCALE_DEFAULTS: Record<string, LocaleTypographyDefaults> = {
  de: { abbreviations: DE_ABBREVIATIONS },
  uk: { abbreviations: UK_ABBREVIATIONS },
  en: { abbreviations: EN_ABBREVIATIONS },
};

export function getLocaleDefaults(locale: string): LocaleTypographyDefaults {
  return LOCALE_DEFAULTS[locale] ?? { abbreviations: new Set() };
}
