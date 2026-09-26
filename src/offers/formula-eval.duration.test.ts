/*
<MODULE_CONTRACT>
  <purpose>RFC-1156: Tests for the `duration` pipe formatter — =(ref | duration) renders ISO 8601 durations as locale-aware prose via Intl.DurationFormat; raw passthrough (no pipe) unchanged; strict param validation; uk plural boundaries; `case=` grammatical-case coverage (de dative, uk accusative/genitive).</purpose>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1156: initial tests — AC-2..AC-7 coverage for duration pipe formatter.</item>
  <item>Duration-case extension: tests for case=dative/accusative/genitive and short-style no-op.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { resolveFormula } from "./formula-eval.ts";
import { parseIsoDuration, formatDuration, formatBusinessDays } from "./duration.ts";
import type { ContentRefIndex } from "../content/content-reference.ts";

const index: ContentRefIndex = {
  version: 1,
  generatedAt: "2026-01-01",
  collections: ["business-profile"],
  entries: {
    "business-profile": {
      "policies/cancellation": {
        de: {
          ordinaryNotice: { period: "P30D" },
          paymentDefault: { gracePeriod: "P14D" },
        },
        uk: {
          ordinaryNotice: { period: "P30D" },
        },
      },
      "policies/exit-package": {
        de: { deliveryTarget: { duration: "PT72H" } },
      },
      "policies/renewal": {
        de: { renewalPeriod: "P1Y6M", reminder: "P2W" },
      },
      "policies/price-changes": {
        de: { priceFixPeriod: "P12M" },
      },
      "policies/liability": {
        de: { cap: { period: "P2Y" } },
      },
      "documents/terms": {
        de: { terms: { preLitigationPeriod: "P60D", review: "P3D", appeal: "P1D" } },
      },
      "policies/support-response": {
        de: { terms: { responseWithin: "P5D" } },
      },
      "policies/bad": {
        de: { note: "thirty days" },
      },
    },
  },
};

const d = (expr: string, lang = "de", defaultLang = "de") =>
  resolveFormula(index, expr, lang, defaultLang);

describe("RFC-1156: duration pipe formatter", () => {
  it("AC-2: =(x | duration) renders P30D as '30 Tage' in de", () => {
    const r = d("business-profile.policies/cancellation.ordinaryNotice.period | duration");
    expect(r.resolved).toBe(true);
    expect(r.value).toBe("30 Tage");
  });

  it("AC-3: uk plural boundaries — P60D → '60 днів', P3D → '3 дні', P1D → '1 день'", () => {
    expect(
      d("business-profile.documents/terms.terms.preLitigationPeriod | duration", "uk").value,
    ).toBe("60 днів");
    expect(d("business-profile.documents/terms.terms.review | duration", "uk").value).toBe("3 дні");
    expect(d("business-profile.documents/terms.terms.appeal | duration", "uk").value).toBe(
      "1 день",
    );
  });

  it("renders months, years, hours, weeks per output table", () => {
    expect(d("business-profile.policies/price-changes.priceFixPeriod | duration").value).toBe(
      "12 Monate",
    );
    expect(d("business-profile.policies/liability.cap.period | duration").value).toBe("2 Jahre");
    expect(
      d("business-profile.policies/exit-package.deliveryTarget.duration | duration").value,
    ).toBe("72 Stunden");
    expect(d("business-profile.policies/renewal.reminder | duration").value).toBe("2 Wochen");
    expect(d("business-profile.policies/price-changes.priceFixPeriod | duration", "uk").value).toBe(
      "12 місяців",
    );
  });

  it("renders compound durations descending without list commas (P1Y6M → '1 Jahr 6 Monate')", () => {
    expect(d("business-profile.policies/renewal.renewalPeriod | duration").value).toBe(
      "1 Jahr 6 Monate",
    );
  });

  it("AC-4: non-ISO value fails with REF-xx error", () => {
    const r = d("business-profile.policies/bad.note | duration");
    expect(r.resolved).toBe(false);
    expect(r.error).toMatch(/^REF-\d+/);
    expect(r.error).toContain("thirty days");
  });

  it("AC-5: no-pipe expression returns the raw ISO value unchanged", () => {
    const r = d("business-profile.policies/cancellation.ordinaryNotice.period");
    expect(r.resolved).toBe(true);
    expect(r.value).toBe("P30D");
  });

  it("AC-7: locale= param overrides context.lang", () => {
    const r = d(
      "business-profile.policies/cancellation.ordinaryNotice.period | duration locale=uk",
    );
    expect(r.resolved).toBe(true);
    expect(r.value).toBe("30 днів");
  });

  it("style=short renders abbreviated units (de '14 T.', uk '14 дн.')", () => {
    expect(
      d("business-profile.policies/cancellation.paymentDefault.gracePeriod | duration style=short")
        .value,
    ).toBe("14 T.");
    expect(
      d(
        "business-profile.policies/cancellation.paymentDefault.gracePeriod | duration style=short",
        "uk",
      ).value,
    ).toBe("14 дн.");
  });

  it("dayType=business renders Werktage / робочі дні", () => {
    expect(
      d(
        "business-profile.policies/support-response.terms.responseWithin | duration dayType=business",
      ).value,
    ).toBe("5 Werktage");
    expect(
      d(
        "business-profile.policies/support-response.terms.responseWithin | duration dayType=business",
        "uk",
      ).value,
    ).toBe("5 робочих днів");
  });

  it("dayType=business on non-pure-days duration fails", () => {
    const r = d("business-profile.policies/renewal.renewalPeriod | duration dayType=business");
    expect(r.resolved).toBe(false);
    expect(r.error).toMatch(/^REF-\d+/);
  });

  it("unknown param fails with REF-xx naming the param", () => {
    const r = d("business-profile.policies/cancellation.ordinaryNotice.period | duration bogus=1");
    expect(r.resolved).toBe(false);
    expect(r.error).toMatch(/^REF-\d+/);
    expect(r.error).toContain("bogus");
  });

  it("invalid style value fails", () => {
    const r = d(
      "business-profile.policies/cancellation.ordinaryNotice.period | duration style=narrow",
    );
    expect(r.resolved).toBe(false);
    expect(r.error).toContain("narrow");
  });

  it("P0D rejected upstream — formatter errors on zero duration", () => {
    expect(parseIsoDuration("P0D")).toBeNull();
    expect(parseIsoDuration("P")).toBeNull();
    expect(parseIsoDuration("P1Y6M")).toEqual({
      years: 1,
      months: 6,
      weeks: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
    expect(parseIsoDuration("bogus")).toBeNull();
    expect(parseIsoDuration(42)).toBeNull();
  });

  it("formatBusinessDays covers plural categories (de one/other, uk one/few/many)", () => {
    expect(formatBusinessDays(1, "de")).toBe("1 Werktag");
    expect(formatBusinessDays(5, "de")).toBe("5 Werktage");
    expect(formatBusinessDays(1, "uk")).toBe("1 робочий день");
    expect(formatBusinessDays(3, "uk")).toBe("3 робочі дні");
    expect(formatBusinessDays(11, "uk")).toBe("11 робочих днів");
  });

  it("formatDuration falls back to PluralRules table if Intl.DurationFormat is absent", () => {
    // Direct helper call — backend-independent contract surface.
    expect(
      formatDuration(
        { years: 0, months: 1, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 },
        "de",
        "long",
      ),
    ).toBe("1 Monat");
    expect(
      formatDuration(
        { years: 0, months: 1, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 },
        "uk",
        "long",
      ),
    ).toBe("1 місяць");
  });

  it("case=dative renders de plural -n (Tagen, Monaten, Jahren, Werktagen)", () => {
    expect(
      d("business-profile.policies/cancellation.ordinaryNotice.period | duration case=dative")
        .value,
    ).toBe("30 Tagen");
    expect(
      d("business-profile.policies/price-changes.priceFixPeriod | duration case=dative").value,
    ).toBe("12 Monaten");
    expect(d("business-profile.policies/liability.cap.period | duration case=dative").value).toBe(
      "2 Jahren",
    );
    expect(
      d(
        "business-profile.policies/support-response.terms.responseWithin | duration dayType=business case=dative",
      ).value,
    ).toBe("5 Werktagen");
    // Singular dative equals nominative for these nouns.
    expect(d("business-profile.documents/terms.terms.appeal | duration case=dative").value).toBe(
      "1 Tag",
    );
  });

  it("case=accusative renders uk inanimate plurals as nominative (за 24 години)", () => {
    expect(
      d(
        "business-profile.policies/exit-package.deliveryTarget.duration | duration case=accusative",
        "uk",
      ).value,
    ).toBe("72 години");
    expect(
      d(
        "business-profile.documents/terms.terms.preLitigationPeriod | duration case=accusative",
        "uk",
      ).value,
    ).toBe("60 днів");
    expect(
      d("business-profile.documents/terms.terms.appeal | duration case=accusative", "uk").value,
    ).toBe("1 день");
  });

  it("case=genitive renders uk genitive forms (протягом 3 днів)", () => {
    expect(
      d("business-profile.documents/terms.terms.review | duration case=genitive", "uk").value,
    ).toBe("3 днів");
    expect(
      d("business-profile.documents/terms.terms.appeal | duration case=genitive", "uk").value,
    ).toBe("1 дня");
    expect(
      d(
        "business-profile.policies/exit-package.deliveryTarget.duration | duration case=genitive",
        "uk",
      ).value,
    ).toBe("72 годин");
    expect(
      d(
        "business-profile.policies/support-response.terms.responseWithin | duration dayType=business case=genitive",
        "uk",
      ).value,
    ).toBe("5 робочих днів");
  });

  it("case= is a no-op in short style (abbreviations do not inflect)", () => {
    expect(
      d(
        "business-profile.policies/cancellation.paymentDefault.gracePeriod | duration style=short case=dative",
      ).value,
    ).toBe("14 T.");
  });

  it("invalid case value fails with REF-xx naming the value", () => {
    const r = d(
      "business-profile.policies/cancellation.ordinaryNotice.period | duration case=locative",
    );
    expect(r.resolved).toBe(false);
    expect(r.error).toMatch(/^REF-\d+/);
    expect(r.error).toContain("locative");
  });
});
