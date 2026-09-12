/*
<MODULE_CONTRACT>
<purpose>RFC-1077: Canonical fact interface and normalization utility for cross-surface fact parity validation. Shared between werkstatt-shared (contract) and werkstatt-site (extraction logic).</purpose>
<non-goals>
  <item>Do not import from werkstatt-site — this package must not depend on the site plugin.</item>
  <item>Do not implement fact extraction — that lives in werkstatt-site where PbpResolvedGraph is available.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1077: initial implementation — CanonicalFact interface and normalizeFactValue.</item>
</CHANGE_SUMMARY>
*/

/** RFC-1077: A canonical fact extracted from the PBP resolved graph or a rendered surface. */
export interface CanonicalFact {
  /** Fact type: price, address, email, foundingYear, representative, phone, name. */
  type: string;
  /** Entity ID the fact belongs to (e.g. offering ID, business ID, place ID). */
  entityId: string;
  /** Entity type: business, offering, place, contactPoint. */
  entityType: string;
  /** The canonical value as a string (normalized for comparison). */
  value: string;
  /** The surface where this fact was found: html, llms-full, jsonld, canonical. */
  surface: string;
  /** Source file path or URL where the fact was found. */
  source: string;
}

/** RFC-1077: Normalize a fact value for comparison across surfaces. */
export function normalizeFactValue(type: string, value: string): string {
  const trimmed = value.trim();
  if (type === "email") return trimmed.toLowerCase();
  if (type === "phone") return trimmed.replace(/^tel:/, "").replace(/[\s\-()]/g, "");
  if (type === "price") {
    let stripped = trimmed.replace(/\s*(EUR|USD|GBP|CHF|UAH|€|\$|£|₴)\s*$/i, "");
    // Handle German thousands separator: "2.000" → "2000", "1.040" → "1040"
    stripped = stripped.replace(/(\d)\.(\d{3})(?!\d)/g, "$1$2");
    // Handle space thousands separator: "2 000" → "2000"
    stripped = stripped.replace(/(\d)\s(\d{3})(?!\d)/g, "$1$2");
    const num = parseFloat(stripped);
    if (!isNaN(num)) return String(num);
    return stripped;
  }
  return trimmed;
}
