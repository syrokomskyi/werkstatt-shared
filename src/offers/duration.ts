/*
<MODULE_CONTRACT>
  <purpose>RFC-1156: ISO 8601 duration parse/format helpers for the `duration` pipe formatter — Intl.DurationFormat primary backend, Intl.PluralRules-based Werktage/робочі дні business-day rendering, grammatical-case forms (nominative/accusative/genitive/dative) for de/uk prose bindings.</purpose>
  <non-goals>
    <item>Do not register pipe formatters here — registration lives in formula-eval.ts next to "money" (AC-1).</item>
    <item>Do not handle recurrence suffixes — formatRecurrence (RFC-0730) owns "/ Monat"-style output.</item>
    <item>Do not add locales beyond de/uk — other locales fall back to de word forms.</item>
    <item>Do not inflect articles or adjectives — only the duration unit noun declines (CLDR unit case data).</item>
  </non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1156: add duration.ts — parseIsoDuration, formatDuration (Intl.DurationFormat + comma/short-abbrev normalization), formatBusinessDays via Intl.PluralRules.</item>
  <item>Duration-case extension: `case=` param (nominative|accusative|genitive|dative) with vendored CLDR-grammar unit forms for de/uk — "nach 5 Werktagen", "bis zu 30 Tagen", "за 24 години".</item>
</CHANGE_SUMMARY>
*/

export interface DurationParts {
  years: number;
  months: number;
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// Full ISO 8601 duration, multi-component allowed (P1Y6M). Canonical order only.
const ISO_DURATION_PATTERN =
  /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

export function parseIsoDuration(value: unknown): DurationParts | null {
  if (typeof value !== "string") return null;
  const m = ISO_DURATION_PATTERN.exec(value.trim());
  if (!m) return null;
  const [years, months, weeks, days, hours, minutes, seconds] = m
    .slice(1)
    .map((x) => (x === undefined ? 0 : Number(x)));
  const parts: DurationParts = {
    years: years!,
    months: months!,
    weeks: weeks!,
    days: days!,
    hours: hours!,
    minutes: minutes!,
    seconds: seconds!,
  };
  // Reject bare "P"/"PT" and all-zero durations (P0D, PT0S) — no prose form.
  if (Object.values(parts).every((v) => v === 0)) return null;
  return parts;
}

export type DurationStyle = "long" | "short";

/**
 * Grammatical case of the rendered duration phrase (prose context like
 * "nach 5 Werktagen" / "за 24 години"). Applied only in `long` style — `short`
 * abbreviations (T., Std.) do not inflect. Cases without a dedicated row fall
 * back to `nominative` (de accusative/genitive plural of duration nouns equals
 * nominative; the table only lists forms that actually differ).
 */
export type DurationCase = "nominative" | "accusative" | "genitive" | "dative";

// Only de/uk are in scope (site languages). Any other locale falls back to de —
// applied uniformly on the Intl path and the PluralRules fallback so both
// backends render identically.
const SUPPORTED_BASE_LOCALES = new Set(["de", "uk"]);
export function resolveSupportedLocale(locale: string): string {
  const base = locale.split("-")[0] ?? "";
  return SUPPORTED_BASE_LOCALES.has(base) ? base : "de";
}

// RFC-1156 output table normalizations applied to Intl.DurationFormat output:
// list separators and locale-specific abbreviations that diverge from the
// documented contract rows (e.g. Intl renders de short days as "14 Tg.", the
// contract is "14 T.").
const SHORT_OVERRIDES: Record<string, ReadonlyArray<[RegExp, string]>> = {
  de: [[/\bTg\./g, "T."]],
};

export function formatDuration(
  parts: DurationParts,
  locale: string,
  style: DurationStyle,
  grammaticalCase: DurationCase = "nominative",
): string {
  const effective = resolveSupportedLocale(locale);
  // Intl.DurationFormat renders nominative only — any other case falls back to
  // the word-table backend whose per-case forms come from CLDR unit-grammar data.
  const input: Record<string, number> = {};
  for (const [key, v] of Object.entries(parts)) {
    if (v > 0) input[key] = v;
  }
  const DurationFormatCtor = (
    Intl as unknown as {
      DurationFormat: new (
        locales: string,
        options: { style: DurationStyle },
      ) => { format(value: Record<string, number>): string };
    }
  ).DurationFormat;
  let out =
    grammaticalCase === "nominative" && DurationFormatCtor
      ? new DurationFormatCtor(effective, { style }).format(input)
      : formatDurationFallback(parts, effective, grammaticalCase, style);
  // "1 Jahr, 6 Monate" → "1 Jahr 6 Monate" (RFC-1156 output table, compound form).
  out = out.replace(/,\s*/g, " ");
  if (style === "short") {
    const base = effective;
    for (const [pattern, replacement] of SHORT_OVERRIDES[base] ?? []) {
      out = out.replace(pattern, replacement);
    }
  }
  return out;
}

// Word forms per plural category; optional per-case overrides vendored from
// CLDR unit-grammar data (unicode.org/cldr/charts — de/uk duration units).
// Missing case → nominative (de acc/gen plural equal nominative for these nouns).
interface UnitForms {
  nominative: Partial<Record<Intl.LDMLPluralRule, string>>;
  accusative?: Partial<Record<Intl.LDMLPluralRule, string>>;
  genitive?: Partial<Record<Intl.LDMLPluralRule, string>>;
  dative?: Partial<Record<Intl.LDMLPluralRule, string>>;
}

const UNIT_WORDS: Record<keyof DurationParts, Record<string, UnitForms>> = {
  years: {
    de: {
      nominative: { one: "Jahr", other: "Jahre" },
      genitive: { one: "Jahres", other: "Jahre" },
      dative: { one: "Jahr", other: "Jahren" },
    },
    uk: {
      nominative: { one: "рік", few: "роки", many: "років", other: "років" },
      genitive: { one: "року", few: "років", many: "років", other: "року" },
      dative: { one: "рокові", few: "рокам", many: "рокам", other: "року" },
    },
  },
  months: {
    de: {
      nominative: { one: "Monat", other: "Monate" },
      genitive: { one: "Monats", other: "Monate" },
      dative: { one: "Monat", other: "Monaten" },
    },
    uk: {
      nominative: { one: "місяць", few: "місяці", many: "місяців", other: "місяців" },
      genitive: { one: "місяця", few: "місяців", many: "місяців", other: "місяця" },
      dative: { one: "місяцю", few: "місяцям", many: "місяцям", other: "місяцю" },
    },
  },
  weeks: {
    de: {
      nominative: { one: "Woche", other: "Wochen" },
      dative: { one: "Woche", other: "Wochen" },
    },
    uk: {
      nominative: { one: "тиждень", few: "тижні", many: "тижнів", other: "тижнів" },
      genitive: { one: "тижня", few: "тижнів", many: "тижнів", other: "тижня" },
      dative: { one: "тижню", few: "тижням", many: "тижням", other: "тижню" },
    },
  },
  days: {
    de: {
      nominative: { one: "Tag", other: "Tage" },
      genitive: { one: "Tages", other: "Tage" },
      dative: { one: "Tag", other: "Tagen" },
    },
    uk: {
      nominative: { one: "день", few: "дні", many: "днів", other: "днів" },
      genitive: { one: "дня", few: "днів", many: "днів", other: "дня" },
      dative: { one: "дню", few: "дням", many: "дням", other: "дню" },
    },
  },
  hours: {
    de: {
      nominative: { one: "Stunde", other: "Stunden" },
      dative: { one: "Stunde", other: "Stunden" },
    },
    uk: {
      nominative: { one: "година", few: "години", many: "годин", other: "годин" },
      accusative: { one: "годину", few: "години", many: "годин", other: "години" },
      genitive: { one: "години", few: "годин", many: "годин", other: "години" },
      dative: { one: "годині", few: "годинам", many: "годинам", other: "годині" },
    },
  },
  minutes: {
    de: {
      nominative: { one: "Minute", other: "Minuten" },
      dative: { one: "Minute", other: "Minuten" },
    },
    uk: {
      nominative: { one: "хвилина", few: "хвилини", many: "хвилин", other: "хвилин" },
      accusative: { one: "хвилину", few: "хвилини", many: "хвилин", other: "хвилини" },
      genitive: { one: "хвилини", few: "хвилин", many: "хвилин", other: "хвилини" },
      dative: { one: "хвилині", few: "хвилинам", many: "хвилинам", other: "хвилині" },
    },
  },
  seconds: {
    de: {
      nominative: { one: "Sekunde", other: "Sekunden" },
      dative: { one: "Sekunde", other: "Sekunden" },
    },
    uk: {
      nominative: { one: "секунда", few: "секунди", many: "секунд", other: "секунд" },
      accusative: { one: "секунду", few: "секунди", many: "секунд", other: "секунди" },
      genitive: { one: "секунди", few: "секунд", many: "секунд", other: "секунди" },
      dative: { one: "секунді", few: "секундам", many: "секундам", other: "секунді" },
    },
  },
};

const SHORT_WORDS: Record<keyof DurationParts, Record<string, string>> = {
  years: { de: "J.", uk: "р." },
  months: { de: "Mon.", uk: "міс." },
  weeks: { de: "Wo.", uk: "тиж." },
  days: { de: "T.", uk: "дн." },
  hours: { de: "Std.", uk: "год." },
  minutes: { de: "Min.", uk: "хв." },
  seconds: { de: "Sek.", uk: "с." },
};

// Contingency backend when Intl.DurationFormat is unavailable (or a non-nominative
// case is requested): per-locale unit words + Intl.PluralRules (never hand-rolled
// modulo — RFC-1156 risks section).
function formatDurationFallback(
  parts: DurationParts,
  locale: string,
  grammaticalCase: DurationCase = "nominative",
  style: DurationStyle = "long",
): string {
  const base = locale.split("-")[0] ?? "de";
  const pluralRules = new Intl.PluralRules(locale);
  const segments: string[] = [];
  for (const [key, v] of Object.entries(parts) as Array<[keyof DurationParts, number]>) {
    if (v <= 0) continue;
    if (style === "short") {
      // Abbreviations do not inflect — grammatical case is a no-op in short style.
      segments.push(`${v} ${SHORT_WORDS[key][base] ?? SHORT_WORDS[key]["de"]!}`);
      continue;
    }
    const forms = UNIT_WORDS[key][base] ?? UNIT_WORDS[key]["de"]!;
    const words = forms[grammaticalCase] ?? forms["nominative"];
    segments.push(`${v} ${words[pluralRules.select(v)] ?? words["other"]}`);
  }
  return segments.join(" ");
}

// dayType=business: business-day word forms per locale (Werktage semantics),
// with the same per-case structure as UNIT_WORDS.
const BUSINESS_DAY_WORDS: Record<string, UnitForms> = {
  de: {
    nominative: { one: "Werktag", other: "Werktage" },
    genitive: { one: "Werktags", other: "Werktage" },
    dative: { one: "Werktag", other: "Werktagen" },
  },
  uk: {
    nominative: {
      one: "робочий день",
      few: "робочі дні",
      many: "робочих днів",
      other: "робочих днів",
    },
    genitive: {
      one: "робочого дня",
      few: "робочих днів",
      many: "робочих днів",
      other: "робочого дня",
    },
    dative: {
      one: "робочому дню",
      few: "робочим дням",
      many: "робочим дням",
      other: "робочому дню",
    },
  },
};

export function formatBusinessDays(
  days: number,
  locale: string,
  grammaticalCase: DurationCase = "nominative",
): string {
  const base = resolveSupportedLocale(locale);
  const forms = BUSINESS_DAY_WORDS[base] ?? BUSINESS_DAY_WORDS["de"]!;
  const words = forms[grammaticalCase] ?? forms["nominative"];
  const category = new Intl.PluralRules(base).select(days);
  return `${days} ${words[category] ?? words["other"]}`;
}
