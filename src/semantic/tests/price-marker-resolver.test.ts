import { describe, expect, it } from "vitest";
import {
  PRICE_MARKER_RE,
  formatSourcePrice,
  resolveAmountMarkersForSemantic,
  resolvePriceMarkersForSemantic,
  type DerivedPriceEntry,
} from "../price-marker-resolver.ts";

// RFC-1288: OFFERING_URI_PREFIX is gone — fixtures key by an arbitrary host.
const TEST_OFFERINGS_PREFIX = "https://test.example/id/offerings/";

describe("constants", () => {
  it("PRICE_MARKER_RE matches price markers", () => {
    const text = "{price:hosting:monthly}";
    PRICE_MARKER_RE.lastIndex = 0;
    const match = PRICE_MARKER_RE.exec(text);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("hosting");
    expect(match![2]).toBe("monthly");
  });
});

describe("formatSourcePrice", () => {
  it("formats EUR amount with narrowSymbol for de", () => {
    const result = formatSourcePrice("10", "de");
    expect(result).toContain("10");
    expect(result).toContain("€");
  });

  it("returns 0 € for non-numeric amount", () => {
    expect(formatSourcePrice("not-a-number", "de")).toBe("0\u00A0€");
  });
});

describe("resolvePriceMarkersForSemantic", () => {
  const derivedPrices: Record<string, DerivedPriceEntry[]> = {
    [`${TEST_OFFERINGS_PREFIX}hosting`]: [
      {
        chargeRef: "monthly",
        targetCurrency: "USD",
        amount: { value: "15", currency: "USD" },
        trace: {
          source: { amount: "10", currency: "EUR" },
          rate: { value: "0.9", pair: "EUR/USD" },
        },
      },
    ],
  };

  it("resolves price marker to source currency", () => {
    const result = resolvePriceMarkersForSemantic(
      "Price: {price:hosting:monthly}",
      "de",
      derivedPrices,
    );
    expect(result).toContain("10");
    expect(result).toContain("€");
    expect(result).not.toContain("{price:");
  });

  it("leaves the marker verbatim for unknown offering (RFC-1288 — no 0 € fallback)", () => {
    const result = resolvePriceMarkersForSemantic(
      "Price: {price:unknown:charge}",
      "de",
      derivedPrices,
    );
    expect(result).toBe("Price: {price:unknown:charge}");
  });

  it("returns text unchanged when no markers", () => {
    expect(resolvePriceMarkersForSemantic("No markers", "de", derivedPrices)).toBe("No markers");
  });
});

describe("resolveAmountMarkersForSemantic", () => {
  it("resolves amount marker to EUR", () => {
    const result = resolveAmountMarkersForSemantic("Threshold: {amount:50}", "de");
    expect(result).toContain("50");
    expect(result).toContain("€");
    expect(result).not.toContain("{amount:");
  });

  it("returns text unchanged when no markers", () => {
    expect(resolveAmountMarkersForSemantic("No markers", "de")).toBe("No markers");
  });
});
