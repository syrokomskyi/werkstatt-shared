/*
<MODULE_CONTRACT>
<purpose>Schema primitive normalizing YAML-native date scalars: a string-typed timestamp field accepts a parsed Date instance (unquoted YAML timestamp) and returns the ISO-8601 lexical form.</purpose>
<non-goals>
  <item>Apply only to fields the schema declares string-typed — never blanket-replace z.string(), never touch z.date() fields.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1374: isoDateString() — union of z.date().transform(toISOString) + caller string schema for string-typed timestamp fields so unquoted YAML date scalars normalize instead of failing the parse.</item>
  <item>RFC-1374: normalize YAML-native date scalars — isoDateString on string-typed timestamp fields + content.scalar-types.lint advisory (CONTENT-SCALAR-01)</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

/**
 * RFC-1374: YAML loaders parse unquoted `2026-10-23`-style scalars into `Date`
 * instances before the schema ever sees them, so a plain `z.string()` rejects
 * legitimately-authored timestamps. `isoDateString()` accepts either an ISO
 * string or a `Date` and always yields the ISO-8601 string form, keeping the
 * stored contract (string) unchanged for every consumer.
 *
 * Implemented as a union — not `z.preprocess` — because `z.infer` of a
 * ZodPreprocess member collapses the field to `unknown`, breaking output-side
 * consumers (RawPageOutput, RawSitemapProjection).
 */
export function isoDateString(
  schema: z.ZodString = z.string(),
): z.ZodUnion<[z.ZodPipe<z.ZodDate, z.ZodTransform<string, Date>>, z.ZodString]> {
  return z.union([z.date().transform((d) => d.toISOString()), schema]);
}
