/*
<MODULE_CONTRACT>
  <purpose>RFC-1156: ISO 8601 duration parse/format helpers for the `duration` pipe formatter — Intl.DurationFormat primary backend, Intl.PluralRules-based Werktage/робочі дні business-day rendering.</purpose>
  <non-goals>
    <item>Do not register pipe formatters here — registration lives in formula-eval.ts next to "money" (AC-1).</item>
    <item>Do not handle recurrence suffixes — formatRecurrence (RFC-0730) owns "/ Monat"-style output.</item>
    <item>Do not add locales beyond de/uk — other locales fall back to de word forms.</item>
  </non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1156: add duration.ts — parseIsoDuration, formatDuration (Intl.DurationFormat + comma/short-abbrev normalization), formatBusinessDays via Intl.PluralRules.</item>
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
): string {
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
  let out = DurationFormatCtor
    ? new DurationFormatCtor(locale, { style }).format(input)
    : formatDurationFallback(parts, locale);
  // "1 Jahr, 6 Monate" → "1 Jahr 6 Monate" (RFC-1156 output table, compound form).
  out = out.replace(/,\s*/g, " ");
  if (style === "short") {
    const base = locale.split("-")[0] ?? "";
    for (const [pattern, replacement] of SHORT_OVERRIDES[base] ?? []) {
      out = out.replace(pattern, replacement);
    }
  }
  return out;
}

// Contingency backend when Intl.DurationFormat is unavailable: per-locale unit
// words + Intl.PluralRules (never hand-rolled modulo — RFC-1156 risks section).
const UNIT_WORDS: Record<
  keyof DurationParts,
  Record<string, Partial<Record<Intl.LDMLPluralRule, string>>>
> = {
  years: {
    de: { one: "Jahr", other: "Jahre" },
    uk: { one: "рік", few: "роки", many: "років", other: "років" },
  },
  months: {
    de: { one: "Monat", other: "Monate" },
    uk: { one: "місяць", few: "місяці", many: "місяців", other: "місяців" },
  },
  weeks: {
    de: { one: "Woche", other: "Wochen" },
    uk: { one: "тиждень", few: "тижні", many: "тижнів", other: "тижнів" },
  },
  days: {
    de: { one: "Tag", other: "Tage" },
    uk: { one: "день", few: "дні", many: "днів", other: "днів" },
  },
  hours: {
    de: { one: "Stunde", other: "Stunden" },
    uk: { one: "година", few: "години", many: "годин", other: "годин" },
  },
  minutes: {
    de: { one: "Minute", other: "Minuten" },
    uk: { one: "хвилина", few: "хвилини", many: "хвилин", other: "хвилин" },
  },
  seconds: {
    de: { one: "Sekunde", other: "Sekunden" },
    uk: { one: "секунда", few: "секунди", many: "секунд", other: "секунд" },
  },
};

function formatDurationFallback(parts: DurationParts, locale: string): string {
  const base = locale.split("-")[0] ?? "de";
  const pluralRules = new Intl.PluralRules(locale);
  const segments: string[] = [];
  for (const [key, v] of Object.entries(parts) as Array<
    [keyof DurationParts, number]
  >) {
    if (v <= 0) continue;
    const words = UNIT_WORDS[key][base] ?? UNIT_WORDS[key]["de"]!;
    segments.push(`${v} ${words[pluralRules.select(v)] ?? words["other"]}`);
  }
  return segments.join(" ");
}

// dayType=business: business-day word forms per locale (Werktage semantics).
const BUSINESS_DAY_WORDS: Record<
  string,
  Partial<Record<Intl.LDMLPluralRule, string>>
> = {
  de: { one: "Werktag", other: "Werktage" },
  uk: {
    one: "робочий день",
    few: "робочі дні",
    many: "робочих днів",
    other: "робочих днів",
  },
};

export function formatBusinessDays(days: number, locale: string): string {
  const base = locale.split("-")[0] ?? "de";
  const words = BUSINESS_DAY_WORDS[base] ?? BUSINESS_DAY_WORDS["de"]!;
  const category = new Intl.PluralRules(locale).select(days);
  return `${days} ${words[category] ?? words["other"]}`;
}
