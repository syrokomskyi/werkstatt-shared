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
  <item>RFC-1308: review REVIEW-CODE-2026-10-16-06 fixes: exception-liveness test, CosmicCatalogName union, names-tuple cross-collisions, known-collisions subpath export, test MODULE_CONTRACT, runbook sync; AC-4 sweep recorded: cosmicName Atlas only in faq-list-section manifest+story (PlanetCatalog layer)</item>
</CHANGE_SUMMARY>
*/

/** Cosmic catalog identifiers usable in collision declarations — the closed
 *  set of catalogs an exception may name (DNA-23). */
export type CosmicCatalogName = "StarCatalog" | "PlanetCatalog" | "MoonCatalog";

/** Declared cross-catalog name collisions — spellings spanning multiple
 *  catalogs, each with the RFC that grandfathered it. `names` holds a single
 *  spelling for an exact-name collision, or two or more spellings that
 *  collide only after RFC-1300 normalization. Empty when no exceptions
 *  remain. */
export const KNOWN_CROSS_CATALOG_COLLISIONS: ReadonlyArray<{
  names: readonly [string, ...string[]];
  catalogs: readonly [CosmicCatalogName, CosmicCatalogName, ...CosmicCatalogName[]];
  reason: string;
  rfc: string;
}> = [];

/** Declared same-catalog normalized collisions — distinct names inside one
 *  catalog colliding under RFC-1300 normalization (lowercase; k→c, j→i,
 *  ae→e, ph→f, y→i; doubled letters collapsed). */
export const KNOWN_SAME_CATALOG_COLLISIONS: ReadonlyArray<{
  names: readonly [string, string, ...string[]];
  catalog: CosmicCatalogName;
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
