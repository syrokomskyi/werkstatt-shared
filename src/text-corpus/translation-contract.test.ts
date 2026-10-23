/*
<MODULE_CONTRACT>
<purpose>
Unit tests for werkstatt/translation-contract@1 (RFC-1372) — fixture parse,
schema rejections, and the resolveTranslatorNote overlay merge order.
</purpose>
<non-goals>
  <item>No command/CONTRACT-rule coverage — those live in werkstatt-site.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1372: initial — fixture parse, strict-schema rejection, merge order pins.</item>
  <item>RFC-1372: unify terminology, voice, and translator guidance into a per-site translation contract (RFC-1372)</item>
</CHANGE_SUMMARY>
*/

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parse as parseYaml } from "yaml";

import {
  resolveTranslatorNote,
  translationContractSchema,
} from "./translation-contract.ts";

const FIXTURE = parseYaml(
  readFileSync(join(import.meta.dirname, "translation-contract.fixture.yaml"), "utf-8"),
) as unknown;

describe("translationContractSchema", () => {
  test("the shipped fixture parses (AC-2)", () => {
    const r = translationContractSchema.safeParse(FIXTURE);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.schema).toBe("werkstatt/translation-contract@1");
      expect(r.data.terms[0].forms.de.canonical).toBe("Einrichtungsgebühr");
      expect(r.data.modules.pseo.terms).toHaveLength(1);
      expect(r.data.modules.pseo.moduleContextHash).toBe("sha256:example");
    }
  });

  test("a term with a forbidden-only locale form is legal (migrated glossaries)", () => {
    const r = translationContractSchema.safeParse({
      schema: "werkstatt/translation-contract@1",
      lifecycle: { status: "draft" },
      terms: [{ id: "x", forms: { de: { forbidden: ["billig"] } } }],
      note: {},
    });
    expect(r.success).toBe(true);
  });

  test("unknown keys fail — the contract is a strict persisted artifact", () => {
    const r = translationContractSchema.safeParse({
      schema: "werkstatt/translation-contract@1",
      lifecycle: { status: "draft" },
      bogus: 1,
    });
    expect(r.success).toBe(false);
  });

  test("a term id outside kebab-case fails", () => {
    const r = translationContractSchema.safeParse({
      schema: "werkstatt/translation-contract@1",
      lifecycle: { status: "draft" },
      terms: [{ id: "Not_A_Term", forms: {} }],
    });
    expect(r.success).toBe(false);
  });
});

describe("resolveTranslatorNote", () => {
  const contract = translationContractSchema.parse(FIXTURE);

  test("site values survive when neither locale nor module overrides them", () => {
    const note = resolveTranslatorNote(contract, "uk");
    expect(note.audience).toBe("German-speaking small business owners");
    expect(note.doNotTranslate).toEqual(["pageIds", "URLs", "brand names"]);
  });

  test("site locale override replaces same-named fields only", () => {
    const note = resolveTranslatorNote(contract, "de");
    expect(note.voice).toBe("Formell, Sie-Form");
    expect(note.audience).toBe("German-speaking small business owners");
  });

  test("module overlay replaces site fields; module locales overlay on top (AC-6)", () => {
    const note = resolveTranslatorNote(contract, "de", "pseo");
    // module.note.audience overrides site; module locales.de.forbiddenMoves overrides all
    expect(note.audience).toBe("small German craft businesses");
    expect(note.forbiddenMoves).toEqual(["Do not invent project evidence"]);
    // untouched fields stay site-level
    expect(note.preserveExactly).toEqual([
      "numbers",
      "dates",
      "prices",
      "legal references",
    ]);
  });

  test("module overlay for a different locale does not leak", () => {
    const note = resolveTranslatorNote(contract, "uk", "pseo");
    expect(note.audience).toBe("small German craft businesses");
    expect(note.forbiddenMoves).toEqual(["Do not invent reviews or prices"]);
  });
});
