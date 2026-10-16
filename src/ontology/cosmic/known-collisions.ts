/*
<MODULE_CONTRACT>
<purpose>
Declared catalog-collision exceptions for the Uni UI Ontology cosmic overlay —
the single reviewable place where cross-catalog and same-catalog name
collisions are recorded with a justification and the RFC that grandfathered
them (DNA-19, DNA-23, RFC-1308).
</purpose>
<non-goals>
  <item>Do not record resolved collisions — history lives in git and the RFC trail.</item>
  <item>Do not add entries without a justification and a grandfathering RFC.</item>
  <item>Do not import from outside the cosmic directory.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1308: module created — KNOWN_CROSS_CATALOG_COLLISIONS (empty after
the Atlas/Tureis rename) and KNOWN_SAME_CATALOG_COLLISIONS (seeded with the
pre-existing Alfecca/Alphecca StarCatalog pair, normalized "alfeca").</item>
</CHANGE_SUMMARY>
*/

/** Declared cross-catalog name collisions — one name spanning multiple
 *  catalogs, each with the RFC that grandfathered it. Empty when no
 *  exceptions remain. */
export const KNOWN_CROSS_CATALOG_COLLISIONS: ReadonlyArray<{
  name: string;
  catalogs: readonly [string, string, ...string[]];
  reason: string;
  rfc: string;
}> = [];

/** Declared same-catalog normalized collisions — distinct names inside one
 *  catalog colliding under RFC-1300 normalization (lowercase; k→c, j→i,
 *  ae→e, ph→f, y→i; doubled letters collapsed). */
export const KNOWN_SAME_CATALOG_COLLISIONS: ReadonlyArray<{
  names: readonly [string, string, ...string[]];
  catalog: string;
  normalized: string;
  reason: string;
  rfc: string;
}> = [
  {
    names: ["Alfecca", "Alphecca"],
    catalog: "StarCatalog",
    normalized: "alfeca",
    reason:
      "Two distinct IAU WGSN star names colliding under RFC-1300 normalization; pre-existing since RFC-0025, recorded (not renamed) by RFC-1308.",
    rfc: "RFC-1308",
  },
];
