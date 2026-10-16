import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test, expect, describe } from "vitest";
import YAML from "yaml";
import { PlanetCatalog } from "./planet-catalog.ts";
import { MoonCatalog } from "./moon-catalog.ts";
import { StarCatalog } from "./star-catalog.ts";

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

describe("RFC-1300 PlanetCatalog extension", () => {
  test("AC-1: catalog holds at least 239 names", () => {
    expect(PlanetCatalog.length).toBeGreaterThanOrEqual(239);
  });

  test("AC-2: no duplicate names within PlanetCatalog", () => {
    expect(new Set(PlanetCatalog).size).toBe(PlanetCatalog.length);
  });

  test("AC-3: no exact or normalized collision with Star/Moon catalogs", () => {
    // Pre-existing collision grandfathered by RFC-1300 (renaming existing
    // entries is an explicit non-goal): "Atlas" is both a Saturn moon here
    // and a Pleiades star in StarCatalog since RFC-0025.
    const grandfathered = new Set(["Atlas"]);
    const others = new Map<string, string>();
    for (const n of [...StarCatalog, ...MoonCatalog]) {
      others.set(normalize(n), n);
    }
    for (const name of PlanetCatalog) {
      const hit = others.get(normalize(name));
      if (grandfathered.has(name)) {
        expect(hit, `grandfathered "${name}" no longer collides`).toBe(name);
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
