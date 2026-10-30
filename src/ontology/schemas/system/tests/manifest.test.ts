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
  <item>RFC-1444: replace companion renditions with section-scoped languages (RFC-1444)</item>
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

function manifestWithSectionLanguages(sectionLanguages: unknown) {
  return {
    ...MINIMAL_MANIFEST,
    i18n: { ...MINIMAL_MANIFEST.i18n, sectionLanguages },
  };
}

describe("i18n.sectionLanguages strict schema (RFC-1444)", () => {
  it("i18n.sectionLanguages rejects unknown keys under the strict schema", () => {
    for (const decl of [
      { languages: { de: { name: "Deutsch" } }, langg: "de" },
      { languages: { de: { name: "Deutsch" } }, mode: "props" },
      { languages: { de: { name: "Deutsch", nam: "x" } } },
    ]) {
      expect(() => systemManifestSchema.parse(manifestWithSectionLanguages(decl))).toThrow();
    }
  });

  it("i18n.sectionLanguages rejects a languages key that is not a BCP 47 tag", () => {
    for (const key of ["de_DE", "deutsch!", "123", ""]) {
      const decl = { languages: { [key]: { name: "Deutsch" } } };
      expect(() => systemManifestSchema.parse(manifestWithSectionLanguages(decl))).toThrow();
    }
  });

  it("i18n.sectionLanguages accepts valid declarations including script and region subtags", () => {
    for (const key of ["de", "pt-BR", "zh-Hant"]) {
      const decl = { languages: { [key]: { name: "Deutsch" } } };
      const parsed = systemManifestSchema.parse(manifestWithSectionLanguages(decl));
      expect(Object.keys(parsed.i18n?.sectionLanguages?.languages ?? {})).toContain(key);
      expect(parsed.i18n?.sectionLanguages?.languages?.[key]?.name).toBe("Deutsch");
    }
  });

  it("accepts layout, switcher variant and shell key declarations", () => {
    const decl = {
      languages: { de: { name: "Deutsch" } },
      defaultLayout: "switch",
      switcherVariant: "text",
      shell: ["footer.navGroups.legalTitle", "header.motto"],
    };
    const parsed = systemManifestSchema.parse(manifestWithSectionLanguages(decl));
    expect(parsed.i18n?.sectionLanguages?.defaultLayout).toBe("switch");
    expect(parsed.i18n?.sectionLanguages?.switcherVariant).toBe("text");
    expect(parsed.i18n?.sectionLanguages?.shell).toHaveLength(2);
  });

  it("rejects invalid layout and switcher variant enum values", () => {
    for (const decl of [
      { languages: { de: { name: "Deutsch" } }, defaultLayout: "columns" },
      { languages: { de: { name: "Deutsch" } }, switcherVariant: "dropdown" },
      { languages: { de: { name: "Deutsch" } }, shell: [] },
    ]) {
      expect(() => systemManifestSchema.parse(manifestWithSectionLanguages(decl))).toThrow();
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

describe("i18n.sectionLanguages bcp47Tag parity (RFC-1444)", () => {
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
