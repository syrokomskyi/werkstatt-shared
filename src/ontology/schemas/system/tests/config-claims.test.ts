/*
<MODULE_CONTRACT>
<purpose>
Unit tests for the RFC-1447 configClaims manifest key — strict entry shape,
closed fact enum, and claim-path regex (AC-4).
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1447: initial — configClaims schema coverage (AC-4)</item>
  <item>RFC-1447: add config-claims binding validation to pbp.content.validate</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { systemManifestSchema } from "../manifest.ts";

const MINIMAL_MANIFEST = {
  app: "test-app",
  version: "1.0.0",
  identity: { systemStar: "Vega", biome: "test-biome" },
  i18n: {
    default: "ru",
    supported: { ru: {}, uz: {} },
  },
};

function manifestWithConfigClaims(configClaims: unknown) {
  return { ...MINIMAL_MANIFEST, configClaims };
}

describe("configClaims strict schema (RFC-1447)", () => {
  it("AC-4: accepts the closed fact enum", () => {
    for (const fact of ["languages", "domain", "legalJurisdiction"]) {
      const parsed = systemManifestSchema.parse(
        manifestWithConfigClaims([
          { claim: "trust/claims/site-languages", fact },
        ]),
      );
      expect(parsed.configClaims?.[0]?.fact).toBe(fact);
    }
  });

  it("AC-4: rejects a fact outside the enum", () => {
    for (const fact of ["emails", "prices", ""]) {
      expect(
        systemManifestSchema.safeParse(
          manifestWithConfigClaims([
            { claim: "trust/claims/site-languages", fact },
          ]),
        ).success,
      ).toBe(false);
    }
  });

  it("AC-4: rejects claim paths outside trust/claims/<id>", () => {
    for (const claim of [
      "trust/claims/",
      "organization/legal-identity",
      "trust/claims/Site-Languages",
      "claims/site-languages",
    ]) {
      expect(
        systemManifestSchema.safeParse(
          manifestWithConfigClaims([{ claim, fact: "languages" }]),
        ).success,
      ).toBe(false);
    }
  });

  it("AC-4: rejects unknown keys on entries (strict)", () => {
    expect(
      systemManifestSchema.safeParse(
        manifestWithConfigClaims([
          { claim: "trust/claims/site-languages", fact: "languages", locale: "ru" },
        ]),
      ).success,
    ).toBe(false);
  });

  it("absent configClaims stays optional", () => {
    expect(systemManifestSchema.parse(MINIMAL_MANIFEST).configClaims).toBeUndefined();
  });
});
