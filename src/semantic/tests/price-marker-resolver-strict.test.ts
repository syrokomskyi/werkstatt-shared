/*
<MODULE_CONTRACT>
<purpose>[RFC-1288] Unit tests for strict price marker resolution: resolvePriceMarkersStrict, findDerivedPrice suffix lookup, verbatim unresolved markers, and the no-"0 €"-fallback contract of resolvePriceMarkersForSemantic.</purpose>
<keywords>price-marker, strict-resolver, semantic, test, RFC-1288</keywords>
</MODULE_CONTRACT>
*/

import { test, expect, describe } from "vitest";
import {
  findDerivedPrice,
  offeringIdFromRef,
  resolvePriceMarkersForSemantic,
  resolvePriceMarkersStrict,
  type DerivedPriceEntry,
} from "../price-marker-resolver.ts";

// Deliberately non-warpgogol host — the shared resolver must not depend on a
// site-specific offering URI prefix (RFC-1288 AC-1).
const fixturePrices: Record<string, DerivedPriceEntry[]> = {
  "https://example.org/id/offerings/digital-foundation": [
    {
      chargeRef: "monthlySubscription",
      targetCurrency: "USD",
      amount: { value: "80", currency: "USD" },
      trace: {
        source: { amount: "70", currency: "EUR" },
        rate: { value: "1.1", pair: "EUR/USD" },
      },
    },
  ],
};

describe("resolvePriceMarkersStrict", () => {
  test("AC-1: resolves a marker keyed by a non-warpgogol host", () => {
    const result = resolvePriceMarkersStrict(
      "Ab {price:digital-foundation:monthlySubscription} pro Monat",
      "de",
      fixturePrices,
    );
    expect(result.text).toBe("Ab 70 € pro Monat");
    expect(result.unresolved).toEqual([]);
  });

  test("AC-2/AC-8: unknown chargeRef stays verbatim and reports unknown-charge", () => {
    const marker = "{price:digital-foundation:unknownCharge}";
    const result = resolvePriceMarkersStrict(`Preis: ${marker}`, "de", fixturePrices);
    expect(result.text).toBe(`Preis: ${marker}`);
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0]!.reason).toBe("unknown-charge");
    expect(result.unresolved[0]!.marker).toBe(marker);
  });

  test("unknown offering stays verbatim and reports unknown-offering", () => {
    const marker = "{price:no-such-offering:monthly}";
    const result = resolvePriceMarkersStrict(marker, "de", fixturePrices);
    expect(result.text).toBe(marker);
    expect(result.unresolved[0]!.reason).toBe("unknown-offering");
  });

  test("null derivedPrices reports no-derived-prices", () => {
    const marker = "{price:digital-foundation:monthlySubscription}";
    const result = resolvePriceMarkersStrict(marker, "de", null);
    expect(result.text).toBe(marker);
    expect(result.unresolved[0]!.reason).toBe("no-derived-prices");
  });

  test("two keys ending in the same offering id report ambiguous-offering", () => {
    const ambiguous: Record<string, DerivedPriceEntry[]> = {
      "https://a.example/id/offerings/digital-foundation":
        fixturePrices["https://example.org/id/offerings/digital-foundation"]!,
      "https://b.example/id/offerings/digital-foundation":
        fixturePrices["https://example.org/id/offerings/digital-foundation"]!,
    };
    const marker = "{price:digital-foundation:monthlySubscription}";
    const result = resolvePriceMarkersStrict(marker, "de", ambiguous);
    expect(result.text).toBe(marker);
    expect(result.unresolved[0]!.reason).toBe("ambiguous-offering");
  });

  test("missing trace.source.amount reports no-source-amount even when amount.value exists", () => {
    const noSource: Record<string, DerivedPriceEntry[]> = {
      "https://example.org/id/offerings/digital-foundation": [
        {
          chargeRef: "monthlySubscription",
          targetCurrency: "USD",
          amount: { value: "80", currency: "USD" },
          trace: {
            source: undefined as unknown as { amount: string; currency: string },
            rate: { value: "1.1", pair: "EUR/USD" },
          },
        },
      ],
    };
    const marker = "{price:digital-foundation:monthlySubscription}";
    const result = resolvePriceMarkersStrict(marker, "de", noSource);
    expect(result.text).toBe(marker);
    expect(result.unresolved[0]!.reason).toBe("no-source-amount");
  });

  test("empty/whitespace trace.source.amount reports no-source-amount (not 0 €)", () => {
    for (const degenerate of ["", "   "]) {
      const prices: Record<string, DerivedPriceEntry[]> = {
        "https://example.org/id/offerings/hosting": [
          {
            chargeRef: "monthly",
            targetCurrency: "USD",
            amount: { value: "15", currency: "USD" },
            trace: {
              source: { amount: degenerate, currency: "EUR" },
              rate: { value: "1.1", pair: "EUR/USD" },
            },
          },
        ],
      };
      const marker = "{price:hosting:monthly}";
      const result = resolvePriceMarkersStrict(marker, "de", prices);
      expect(result.text).toBe(marker);
      expect(result.unresolved[0]!.reason).toBe("no-source-amount");
    }
  });

  test("{amount:2500} resolves to 2.500 € for de and never fails", () => {
    const result = resolvePriceMarkersStrict("Budget {amount:2500}", "de", null);
    expect(result.text).toBe("Budget 2.500 €");
    expect(result.unresolved).toEqual([]);
  });

  test("mixed text resolves known markers and reports the rest", () => {
    const result = resolvePriceMarkersStrict(
      "{price:digital-foundation:monthlySubscription} vs {price:other:x} und {amount:50}",
      "de",
      fixturePrices,
    );
    expect(result.text).toBe("70 € vs {price:other:x} und 50 €");
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0]!.reason).toBe("unknown-offering");
  });
});

describe("resolvePriceMarkersForSemantic (RFC-1288 delegation)", () => {
  test("AC-3: unknown offering returns the marker verbatim, not 0 €", () => {
    const result = resolvePriceMarkersForSemantic(
      "{price:unknown-offering:activation}",
      "de",
      fixturePrices,
    );
    expect(result).toBe("{price:unknown-offering:activation}");
    expect(result).not.toContain("0");
  });

  test("known marker resolves identically to the strict resolver", () => {
    const text = "Отримайте {price:digital-foundation:monthlySubscription} щомісяця";
    expect(resolvePriceMarkersForSemantic(text, "de", fixturePrices)).toBe(
      resolvePriceMarkersStrict(text, "de", fixturePrices).text,
    );
  });
});

describe("findDerivedPrice / offeringIdFromRef", () => {
  test("returns the canonical offering ref and all charge matches", () => {
    const found = findDerivedPrice(fixturePrices, "digital-foundation", "monthlySubscription");
    expect("entry" in found).toBe(true);
    if ("entry" in found) {
      expect(found.offeringRef).toBe("https://example.org/id/offerings/digital-foundation");
      expect(found.matching).toHaveLength(1);
    }
  });

  test("offeringIdFromRef strips the canonical infix and passes bare ids through", () => {
    expect(offeringIdFromRef("https://x.test/id/offerings/abc")).toBe("abc");
    expect(offeringIdFromRef("abc")).toBe("abc");
  });
});
