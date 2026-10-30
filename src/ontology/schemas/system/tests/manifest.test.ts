/*
<MODULE_CONTRACT>
<purpose>
Unit tests for manifest covering systemManifestSchema; systemCollectionSchema. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the manifest suite's contract for test-file scaffold coverage.</item>
  <item>RFC-1442: strict i18n.companion schema, companion-locale typography checks</item>
  <item>RFC-1442: bcp47Tag parity guard vs vendored intake pattern</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { systemManifestSchema, systemCollectionSchema } from "../manifest.ts";

describe("systemManifestSchema", () => {
  it("is defined", () => {
    expect(systemManifestSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => systemManifestSchema.parse(null)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// RFC-1442: strict i18n.companion schema (AC-1..AC-3)
// ---------------------------------------------------------------------------

const MINIMAL_MANIFEST = {
  app: "test-app",
  version: "1.0.0",
  identity: { systemStar: "Vega", biome: "test-biome" },
  i18n: {
    default: "ru",
    supported: { ru: {}, uz: {} },
  },
};

function manifestWithCompanion(companion: unknown) {
  return {
    ...MINIMAL_MANIFEST,
    i18n: { ...MINIMAL_MANIFEST.i18n, companion },
  };
}

describe("i18n.companion strict schema (RFC-1442)", () => {
  it("i18n.companion rejects unknown keys under the strict schema", () => {
    for (const companion of [
      { lang: "de", name: "Deutsch", langg: "de" },
      { lang: "de", name: "Deutsch", shells: ["footer.taglineLines"] },
      { lang: "de", name: "Deutsch", mode: "props" },
    ]) {
      expect(() => systemManifestSchema.parse(manifestWithCompanion(companion))).toThrow();
    }
  });

  it("i18n.companion rejects a lang value that is not a BCP 47 tag", () => {
    for (const lang of ["DE", "german", "de_DE", "d", "de-", "not-a-lang!"]) {
      const companion = { lang, name: "Deutsch" };
      expect(() => systemManifestSchema.parse(manifestWithCompanion(companion))).toThrow();
    }
  });

  it("i18n.companion accepts valid declarations including script and region subtags", () => {
    for (const companion of [
      { lang: "de", name: "Deutsch" },
      { lang: "ru", name: "Русский", shell: ["footer.navGroups.legalTitle"] },
      { lang: "uz-Latn", name: "Oʻzbekcha" },
      { lang: "es-419", name: "Español" },
      { lang: "zh-Hant-TW", name: "Fan-ti" },
    ]) {
      const parsed = systemManifestSchema.parse(manifestWithCompanion(companion));
      expect(parsed.i18n?.companion?.lang).toBe(companion.lang);
    }
  });
});

describe("systemCollectionSchema", () => {
  it("is defined", () => {
    expect(systemCollectionSchema).toBeDefined();
  });

  it("rejects null", () => {
    expect(() => systemCollectionSchema.parse(null)).toThrow();
  });
});

describe("i18n.companion bcp47Tag parity (RFC-1442 review)", () => {
  it("stays byte-identical to the vendored intake $defs pattern", async () => {
    const schemaSource = await readFile(
      new URL("../manifest.ts", import.meta.url),
      "utf8",
    );
    const declared = schemaSource.match(
      /const bcp47Tag[\s\S]*?\.regex\(\s*\/(.+?)\//,
    )?.[1];
    const vendored = await readFile(
      join(
        process.cwd(),
        "..",
        "..",
        "docs",
        "specs",
        "werkstatt-onboarding",
        "schemas",
        "werkstatt-intake.schema.yaml",
      ),
      "utf8",
    );
    const specPattern = vendored.match(
      /pattern: (\^\[a-z\]\{2,3\}.+?\$)/,
    )?.[1];
    expect(specPattern, "vendored spec must carry the bcp47Tag pattern").toBeTruthy();
    expect(
      declared,
      "i18n.companion bcp47Tag drifted from the vendored intake $defs pattern — update both copies or hoist a shared const",
    ).toBe(specPattern);
  });
});
