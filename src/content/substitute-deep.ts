/*
<MODULE_CONTRACT>
<purpose>Framework-agnostic deep walk that applies a string-substitution function to every
string leaf of an arbitrary data structure, leaving non-string values unchanged (RFC-0138).</purpose>
<non-goals>
  <item>Do not parse or resolve {collection.file.field} references — that is the caller's
        substitute function (RFC-0045 / RFC-0050 resolvers).</item>
  <item>Do not mutate the input — return a new structure.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0138: extracted the recursive prop-walk so block-prop reference substitution is
        shared by the astro resolver and the page handler, and unit-testable without astro.</item>
  <item>ADR-0105: pass non-plain objects through untouched — Object.entries() on a Date/class
        instance yields [], so rebuilding silently replaced it with {} and shipped
        datetime="[object Object]" + "Invalid Date" to production.</item>
</CHANGE_SUMMARY>
*/

/**
 * Recursively substitutes string leaves of a data structure using `substituteString`.
 *
 * - strings → `await substituteString(value)`
 * - arrays / plain objects → recurse
 * - everything else (number, boolean, null, undefined) → identity
 *
 * The input is not mutated; a new structure is returned.
 */
export async function substituteRefsDeep(
  data: unknown,
  substituteString: (value: string) => Promise<string>,
): Promise<unknown> {
  if (typeof data === "string") {
    return substituteString(data);
  }

  if (Array.isArray(data)) {
    return Promise.all(data.map((item) => substituteRefsDeep(item, substituteString)));
  }

  // Only plain objects are rebuilt. Class instances (Date, URL, custom classes)
  // must pass through untouched: Object.entries() on a Date yields [], so
  // rebuilding would silently replace it with {} (ADR-0105). A prototype check
  // (not toString-tag) is required — class instances without Symbol.toStringTag
  // still report "[object Object]".
  if (data !== null && typeof data === "object") {
    const proto = Object.getPrototypeOf(data);
    if (proto !== Object.prototype && proto !== null) {
      return data;
    }
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = await substituteRefsDeep(value, substituteString);
    }
    return result;
  }

  return data;
}
