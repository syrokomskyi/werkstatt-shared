/*
<MODULE_CONTRACT>
<purpose>
Collision guards for the Uni UI Ontology cosmic catalogs (DNA-19, DNA-23):
RFC-1300 PlanetCatalog extension invariants plus RFC-1308 declared-exception
enforcement — every exact or normalized collision, cross-catalog or
same-catalog, must be recorded in KNOWN_*_CATALOG_COLLISIONS, and stale
declarations whose collision was resolved fail closed.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1308: consume KNOWN_*_CATALOG_COLLISIONS instead of a private
whitelist; add the undeclared same-catalog normalized-collision check and
declared-exception liveness check; header scaffolded (file previously carried
no Compass contract).</item>
</CHANGE_SUMMARY>
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test, expect, describe } from "vitest";
import YAML from "yaml";
import { PlanetCatalog } from "./planet-catalog.ts";
import { MoonCatalog } from "./moon-catalog.ts";
import { StarCatalog } from "./star-catalog.ts";
import {
  KNOWN_CROSS_CATALOG_COLLISIONS,
  KNOWN_SAME_CATALOG_COLLISIONS,
} from "./known-collisions.ts";

// RFC-1300 rule 3, ported verbatim: lowercase; k→c, j→i, ae→e, ph→f, y→i;
// doubled letters collapsed.
const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/k/g, "c")
    .replace(/j/g, "i")
    .replace(/ae/g, "e")
    .replace(/ph/g, "f")
    .replace(/y/g, "i")
    .replace(/(.)\1+/g, "$1");

const ORIGINAL_COUNT = 39;

const here = dirname(fileURLToPath(import.meta.url));
const sources = YAML.parse(readFileSync(join(here, "planet-catalog.sources.yaml"), "utf8")) as {
  names: Record<string, { designation: string; kind: string }>;
};

const CATALOGS = {
  StarCatalog,
  PlanetCatalog,
  MoonCatalog,
} as const;

describe("RFC-1300 PlanetCatalog extension", () => {
  test("AC-1: catalog holds at least 239 names", () => {
    expect(PlanetCatalog.length).toBeGreaterThanOrEqual(239);
  });

  test("AC-2: no duplicate names within PlanetCatalog", () => {
    expect(new Set(PlanetCatalog).size).toBe(PlanetCatalog.length);
  });

  test("AC-3: no exact or normalized collision with Star/Moon catalogs", () => {
    // RFC-1308: declared cross-catalog exceptions live in
    // KNOWN_CROSS_CATALOG_COLLISIONS — the single reviewable surface;
    // the list ships empty (Atlas resolved via the StarCatalog rename).
    const declared = new Map(
      KNOWN_CROSS_CATALOG_COLLISIONS.flatMap((c) => c.names.map((n) => [n, c] as const)),
    );
    const others = new Map<string, string>();
    for (const n of [...StarCatalog, ...MoonCatalog]) {
      others.set(normalize(n), n);
    }
    for (const name of PlanetCatalog) {
      const hit = others.get(normalize(name));
      const exception = declared.get(name);
      if (exception) {
        expect(
          exception.names,
          `declared "${name}" no longer collides — remove the stale entry`,
        ).toContain(hit);
        continue;
      }
      expect(hit, `"${name}" collides with "${hit}"`).toBeUndefined();
    }
    // Rule 3 also forbids collisions inside PlanetCatalog: added names vs the
    // original entries (same-catalog duplicates are covered by AC-2).
    const originalNorm = new Map<string, string>();
    for (const n of PlanetCatalog.slice(0, ORIGINAL_COUNT)) {
      originalNorm.set(normalize(n), n);
    }
    for (const name of PlanetCatalog.slice(ORIGINAL_COUNT)) {
      const hit = originalNorm.get(normalize(name));
      expect(hit, `added "${name}" collides with original "${hit}"`).toBeUndefined();
    }
  });

  test("RFC-1308: no undeclared same-catalog normalized collision", () => {
    // Declared exceptions: KNOWN_SAME_CATALOG_COLLISIONS (e.g. the
    // pre-existing Alfecca/Alphecca pair in StarCatalog, recorded not
    // renamed). Any NEW same-catalog normalized dup fails here.
    const declared = new Map(
      KNOWN_SAME_CATALOG_COLLISIONS.map((c) => [`${c.catalog}::${c.normalized}`, c.names]),
    );
    for (const [catalogName, entries] of Object.entries(CATALOGS)) {
      const seen = new Map<string, string>();
      for (const name of entries) {
        const key = normalize(name);
        const prior = seen.get(key);
        if (prior === undefined) {
          seen.set(key, name);
          continue;
        }
        const exception = declared.get(`${catalogName}::${key}`);
        if (exception) {
          expect(
            exception,
            `declared ${catalogName} exception "${key}" lists different names`,
          ).toEqual(expect.arrayContaining([prior, name]));
          continue;
        }
        expect(
          prior,
          `undeclared normalized collision in ${catalogName}: "${prior}" and "${name}" both normalize to "${key}" — record it in KNOWN_SAME_CATALOG_COLLISIONS with an RFC`,
        ).toBeUndefined();
      }
    }
  });

  test("RFC-1308: declared collisions stay live — resolved entries must be removed", () => {
    // A declaration whose collision no longer exists is dead weight: the
    // module's non-goals forbid recording resolved collisions, so each entry
    // must still describe a real collision in the current catalogs.
    for (const c of KNOWN_CROSS_CATALOG_COLLISIONS) {
      const holders = c.catalogs.filter((cat) =>
        c.names.some((n) => (CATALOGS[cat] as readonly string[]).includes(n)),
      );
      expect(
        holders.length,
        `declared cross-catalog collision "${c.names.join("/")}" no longer spans ${c.catalogs.join(" and ")} — remove the resolved entry`,
      ).toBeGreaterThanOrEqual(2);
      expect(
        new Set(c.names.map(normalize)).size,
        `declared cross-catalog entry "${c.names.join("/")}" lists spellings that do not normalize together`,
      ).toBe(1);
    }
    for (const c of KNOWN_SAME_CATALOG_COLLISIONS) {
      const catalog = CATALOGS[c.catalog] as readonly string[];
      const present = c.names.filter((n) => catalog.includes(n));
      expect(
        present.length,
        `declared ${c.catalog} collision "${c.names.join("/")}" no longer holds — remove the resolved entry`,
      ).toBeGreaterThanOrEqual(2);
      expect(
        present.every((n) => normalize(n) === c.normalized),
        `declared ${c.catalog} entry expects normalized "${c.normalized}" — got ${present.map(normalize).join(", ")}`,
      ).toBe(true);
    }
  });

  test("AC-4: every added name has a sources entry; every sources entry is in the catalog", () => {
    const catalog = new Set<string>(PlanetCatalog);
    const added = PlanetCatalog.slice(ORIGINAL_COUNT);
    for (const name of added) {
      expect(sources.names[name], `missing sources entry for ${name}`).toBeDefined();
    }
    for (const name of Object.keys(sources.names)) {
      expect(catalog.has(name), `sources entry ${name} not in catalog`).toBe(true);
    }
  });
});
