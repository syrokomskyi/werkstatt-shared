/*
<MODULE_CONTRACT>
<purpose>
  Normalize a parser-typed value to an ISO-8601 string for date-bearing props
  (ADR-0105). YAML timestamps arrive as Date instances in collection data —
  the prop contract at the content/UI boundary is string.
</purpose>
<non-goals>
  <item>Do not parse arbitrary date text — only Date instances and strings pass through.</item>
  <item>Do not validate format — schema validators own format correctness.</item>
  <item>Do not throw on invalid Date instances — return "" so the failure is visible but non-fatal.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>ADR-0105: extracted the single normalization point — two consumers (nachweis-list,
        nachweis-evidence) carried divergent copies ("" vs String(value)); invalid Date now
        degrades to "" instead of throwing RangeError mid-build.</item>
</CHANGE_SUMMARY>
*/

/**
 * - `Date` → `toISOString()` (invalid Date → `""` — `toISOString` would throw RangeError)
 * - `string` → unchanged
 * - everything else → `""`
 */
export function toIsoDateString(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  if (typeof value === "string") return value;
  return "";
}
