/*
<MODULE_CONTRACT>
<purpose>Price marker resolution for semantic projections (RFC-0767, RFC-1288). resolvePriceMarkersStrict resolves {price:offering:chargeRef} and {amount:N} markers to source-currency (EUR) strings, reporting unresolved markers explicitly. Offerings are matched by "/id/offerings/&lt;id&gt;" suffix — no site-specific host. Also hosts the relocated DerivedPriceEntry type and marker regexes shared between the semantic layer and packages/ui.</purpose>
<non-goals>
  <item>Does not read files — derived prices are passed as a parameter. File I/O lives in derived-prices-loader.ts.</item>
  <item>Does not append recurrence suffixes — JSON-LD headline/description are free-text strings where recurrence is in the surrounding sentence.</item>
  <item>Does not resolve markers in block-derived content or prose body — only heading, lead, description (RFC-0767 nonGoals).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0767: relocated DerivedPriceEntry, OFFERING_URI_PREFIX, PRICE_MARKER_RE from packages/ui to packages/share to break circular dependency.</item>
  <item>RFC-0767: added formatSourcePrice and resolvePriceMarkersForSemantic for semantic-layer marker resolution.</item>
  <item>RFC-1288: added resolvePriceMarkersStrict, findDerivedPrice, offeringIdFromRef; removed OFFERING_URI_PREFIX and the "0 €" fallback — unresolved markers stay verbatim and are reported for PRICE-RESOLVE-01 diagnostics.</item>
</CHANGE_SUMMARY>
*/

/**
 * Derived price entry shape (moved from packages/ui to packages/share
 * so both the semantic layer and UI components share a single type).
 */
export interface DerivedPriceEntry {
  chargeRef: string;
  targetCurrency: string;
  amount: { value: string; currency: string };
  trace: {
    source: { amount: string; currency: string };
    rate: { value: string; pair: string };
    calculation?: {
      rounding?: {
        mode: string;
        increment?: string;
        decimalPlaces?: number;
        output: string;
      };
    };
  };
}

export const PRICE_MARKER_RE = /\{price:([a-zA-Z0-9_-]+):([a-zA-Z0-9_.-]+)\}/g;
export const AMOUNT_MARKER_RE = /\{amount:([0-9]+(?:\.[0-9]+)?)\}/g;

/** Canonical infix of offering URIs ("<site>/id/offerings/<offeringId>"). */
const OFFERING_ID_INFIX = "/id/offerings/";

/**
 * Format a source-currency amount for semantic projections.
 * Unlike formatPrice in packages/ui, this does NOT append a recurrence
 * suffix — JSON-LD headline/description fields are free-text strings
 * where the recurrence context is already in the surrounding sentence.
 * Uses Intl.NumberFormat with currencyDisplay: "narrowSymbol".
 * Output contains a non-breaking space (U+00A0) between number and symbol.
 */
export function formatSourcePrice(amount: string, lang: string): string {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return "0\u00A0€";
  return new Intl.NumberFormat(lang, {
    style: "currency",
    currency: "EUR",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

export type UnresolvedPriceReason =
  | "no-derived-prices"
  | "unknown-offering"
  | "unknown-charge"
  | "ambiguous-offering"
  | "no-source-amount";

export interface UnresolvedPriceMarker {
  /** Literal marker text, e.g. "{price:digital-foundation:firstYearMonthly}". */
  marker: string;
  offeringId: string;
  chargeRef: string;
  reason: UnresolvedPriceReason;
}

export interface StrictPriceResolution {
  /** Markers that could not be resolved are left verbatim. */
  text: string;
  unresolved: UnresolvedPriceMarker[];
}

export type DerivedPriceLookup =
  | {
      /** First entry matching the chargeRef (all matches share trace.source). */
      entry: DerivedPriceEntry;
      /** The matched canonical derived-prices key (offering URI). */
      offeringRef: string;
      /** All entries for the chargeRef — one per target currency. */
      matching: DerivedPriceEntry[];
    }
  | { reason: UnresolvedPriceReason };

/**
 * Extract the offering id suffix from a canonical offering ref. Refs that
 * already are bare ids (no "/id/offerings/" infix) pass through unchanged.
 */
export function offeringIdFromRef(ref: string): string {
  const idx = ref.lastIndexOf(OFFERING_ID_INFIX);
  return idx >= 0 ? ref.slice(idx + OFFERING_ID_INFIX.length) : ref;
}

/**
 * RFC-1288: single offering/charge lookup for every renderer and projection.
 * Offerings are matched by id suffix (`key.endsWith("/id/offerings/" +
 * offeringId)`) so no site-specific host is baked into shared code. Exactly
 * one key must match — zero gives `unknown-offering`, more than one gives
 * `ambiguous-offering`. `trace.source.amount` is the only authoritative
 * amount: absent or non-numeric gives `no-source-amount` even when
 * `amount.value` exists.
 */
export function findDerivedPrice(
  derivedPrices: Record<string, DerivedPriceEntry[]> | null | undefined,
  offeringId: string,
  chargeRef: string,
): DerivedPriceLookup {
  if (!derivedPrices) return { reason: "no-derived-prices" };
  const suffix = OFFERING_ID_INFIX + offeringId;
  const keys = Object.keys(derivedPrices).filter((key) => key.endsWith(suffix));
  if (keys.length === 0) return { reason: "unknown-offering" };
  if (keys.length > 1) return { reason: "ambiguous-offering" };
  const offeringRef = keys[0]!;
  const matching = (derivedPrices[offeringRef] ?? []).filter((e) => e.chargeRef === chargeRef);
  if (matching.length === 0) return { reason: "unknown-charge" };
  const entry = matching[0]!;
  const sourceAmount = entry.trace?.source?.amount;
  if (
    typeof sourceAmount !== "string" ||
    sourceAmount.trim() === "" ||
    !Number.isFinite(Number(sourceAmount))
  ) {
    return { reason: "no-source-amount" };
  }
  return { entry, offeringRef, matching };
}

/**
 * RFC-1288: strict marker resolution for projections. Resolves
 * {price:offering:chargeRef} and {amount:N} markers to source-currency (EUR)
 * strings. Unresolvable markers stay verbatim in the text and are reported in
 * `unresolved` — callers turn them into PRICE-RESOLVE-01 diagnostics or let
 * DIST-LEAK-06 flag the residue. There is no fallback amount.
 */
export function resolvePriceMarkersStrict(
  text: string,
  lang: string,
  derivedPrices: Record<string, DerivedPriceEntry[]> | null | undefined,
): StrictPriceResolution {
  const unresolved: UnresolvedPriceMarker[] = [];
  const resolvedPrices = text.replace(
    PRICE_MARKER_RE,
    (marker: string, offeringId: string, chargeRef: string) => {
      const found = findDerivedPrice(derivedPrices, offeringId, chargeRef);
      if (!("entry" in found)) {
        unresolved.push({ marker, offeringId, chargeRef, reason: found.reason });
        return marker;
      }
      return formatSourcePrice(found.entry.trace.source.amount, lang);
    },
  );
  return {
    text: resolvedPrices.replace(AMOUNT_MARKER_RE, (_match, amount: string) =>
      formatSourcePrice(amount, lang),
    ),
    unresolved,
  };
}

/**
 * Resolve {price:offering:chargeRef} markers in a string to source-currency
 * (EUR) formatted strings for use in semantic projections (JSON-LD, meta tags).
 *
 * Returns the input string unchanged if no markers are present.
 * RFC-1288: unresolved markers stay verbatim — no "0 €" fallback. DIST-LEAK-06
 * is the enforcement boundary for residue that reaches rendered artifacts.
 */
export function resolvePriceMarkersForSemantic(
  text: string,
  lang: string,
  derivedPrices?: Record<string, DerivedPriceEntry[]> | null,
): string {
  return resolvePriceMarkersStrict(text, lang, derivedPrices).text;
}

/**
 * Resolve {amount:NNNN} markers to source-currency (EUR) formatted strings
 * for semantic projections (JSON-LD, meta tags). These markers represent
 * literal EUR amounts (e.g. thresholds) that are not tied to an offering.
 */
export function resolveAmountMarkersForSemantic(text: string, lang: string): string {
  return text.replace(AMOUNT_MARKER_RE, (_match, amount: string) => {
    return formatSourcePrice(amount, lang);
  });
}
