/*
<MODULE_CONTRACT>
<purpose>Locale-specific typography defaults for the typography rule engine.
Exports abbreviation sets, number format defaults, and apostrophe policy keyed
by locale code (RFC-1068, RFC-1070).</purpose>
<non-goals>
  <item>Do not define typography rules — only locale-specific data.</item>
  <item>Do not read system.md or site configuration.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1068: initial creation with de, uk, en abbreviation sets.</item>
  <item>RFC-1070: added numberFormat and apostrophePolicy to LocaleTypographyDefaults.</item>
</CHANGE_SUMMARY>
*/

export interface LocaleTypographyDefaults {
  /** Abbreviations ending with a period, used for TYPO-CASE-02 exclusion. */
  abbreviations: ReadonlySet<string>;
  /** Number format defaults for TYPO-NUM rules. Added by RFC-1070. */
  numberFormat: {
    decimalSeparator: "," | ".";
    thousandsSeparator: "." | "," | " " | "\u202F";
  };
  /** Apostrophe policy for TYPO-APOS rules. Added by RFC-1070. */
  apostrophePolicy: "straight" | "modifier";
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
  "vs.",
  "lit.",
  "Art.",
  "Inc.",
  "e.V.",
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
  "Див.",
  "нім.",
  "Inc.",
  "e.V.",
]);

const EN_ABBREVIATIONS = new Set(["e.g.", "i.e.", "etc.", "vs.", "No.", "Inc.", "e.V."]);

export const LOCALE_DEFAULTS: Record<string, LocaleTypographyDefaults> = {
  de: {
    abbreviations: DE_ABBREVIATIONS,
    numberFormat: { decimalSeparator: ",", thousandsSeparator: "." },
    apostrophePolicy: "straight",
  },
  uk: {
    abbreviations: UK_ABBREVIATIONS,
    numberFormat: { decimalSeparator: ",", thousandsSeparator: "\u202F" },
    apostrophePolicy: "straight",
  },
  en: {
    abbreviations: EN_ABBREVIATIONS,
    numberFormat: { decimalSeparator: ".", thousandsSeparator: "," },
    apostrophePolicy: "straight",
  },
};

export function getLocaleDefaults(locale: string): LocaleTypographyDefaults {
  return (
    LOCALE_DEFAULTS[locale] ?? {
      abbreviations: new Set(),
      numberFormat: { decimalSeparator: ".", thousandsSeparator: "," },
      apostrophePolicy: "straight",
    }
  );
}
