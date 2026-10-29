/*
<MODULE_CONTRACT>
<purpose>
  RFC-1426 tests for the credits-page shared projection: the
  isMaterialCreditPageVisible predicate matrix (placeholder always excluded,
  display:hidden excluded, shown non-placeholder visible) and
  selectCreditsPageRecords semantics (post-selection filtering, language
  fallback priority, canonical materialTargetKey order).
</purpose>
<non-goals>
  <item>No I/O — pure contract tests over in-memory records.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1426: created.</item>
  <item>RFC-1426: shared credits-page projection in werkstatt-shared, both renderers consume it

isMaterialCreditPageVisible (placeholder or display:hidden -> not on page) in
attribution-display beside the RFC-0231 resolver it amends; selectCreditsPageRecords
owns selection + visibility + materialTargetKey order. service.ts call sites and
credits-gallery switch to it; both selectLocalized copies and the barrel re-export
retired. material.credits.validate gains PAGE-HIDDEN-REFERENCED advisory (rules[]
registered), report gains pageVisible per record. AGENTS.template documents the
page-visibility rule.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { isMaterialCreditPageVisible } from "../attribution-display.ts";
import {
  selectCreditsPageRecords,
  type MaterialCreditRecord,
} from "../material-credits.ts";
import type { MaterialCredit } from "../../schemas/material-credit.ts";

function makeCredit(
  targetId: string,
  overrides: Partial<MaterialCredit> = {},
): MaterialCredit {
  return {
    id: `credit-${targetId}`,
    target: { kind: "image", id: targetId },
    sourceType: "human-made",
    parties: [{ role: "creator", name: "Fotografin", kind: "Person" }],
    license: { label: "CC BY 4.0" },
    ...overrides,
  };
}

function makeRecord(
  targetId: string,
  lang: string | undefined,
  overrides: Partial<MaterialCredit> = {},
): MaterialCreditRecord {
  return {
    file: `src/content/pages/${lang ?? "assets"}/assets/${targetId}.credits.yaml`,
    lang,
    credit: makeCredit(targetId, overrides),
  };
}

describe("RFC-1426 isMaterialCreditPageVisible", () => {
  it("excludes sourceType:placeholder records", () => {
    expect(isMaterialCreditPageVisible(makeCredit("slot-02", { sourceType: "placeholder" }))).toBe(
      false,
    );
  });

  it("excludes display:hidden records", () => {
    expect(isMaterialCreditPageVisible(makeCredit("hero", { display: "hidden" }))).toBe(false);
  });

  it("keeps ordinary records visible (display absent or shown)", () => {
    expect(isMaterialCreditPageVisible(makeCredit("hero"))).toBe(true);
    expect(isMaterialCreditPageVisible(makeCredit("hero", { display: "shown" }))).toBe(true);
  });

  // AC-8: an explicit display:shown override cannot resurrect a placeholder.
  it("AC-8: keeps placeholder excluded even with display:shown", () => {
    expect(
      isMaterialCreditPageVisible(
        makeCredit("slot-02", { sourceType: "placeholder", display: "shown" }),
      ),
    ).toBe(false);
  });
});

describe("RFC-1426 selectCreditsPageRecords", () => {
  // AC-2: a hidden record is absent from the projection.
  it("AC-2: drops display:hidden records from the selected set", () => {
    const records = [
      makeRecord("hero", "de"),
      makeRecord("secret", "de", { display: "hidden" }),
    ];
    const selected = selectCreditsPageRecords(records, "de", "de");
    expect(selected.map((r) => r.credit.target.id)).toEqual(["hero"]);
  });

  it("selects the exact-language twin over default and agnostic records", () => {
    const records = [
      makeRecord("hero", undefined, { title: "agnostic" }),
      makeRecord("hero", "de", { title: "de override" }),
      makeRecord("hero", "uk", { title: "uk twin" }),
    ];
    const selected = selectCreditsPageRecords(records, "uk", "de");
    expect(selected).toHaveLength(1);
    expect(selected[0]?.credit.title).toBe("uk twin");
  });

  it("post-selection filter: a hidden localized record drops the target without falling back to a visible twin", () => {
    const records = [
      makeRecord("hero", undefined),
      makeRecord("hero", "de", { display: "hidden" }),
    ];
    const selected = selectCreditsPageRecords(records, "de", "de");
    expect(selected).toHaveLength(0);
  });

  it("keeps a hidden localized twin from shadowing other-language selections", () => {
    const records = [
      makeRecord("hero", "de", { display: "hidden" }),
      makeRecord("hero", "uk"),
    ];
    const selected = selectCreditsPageRecords(records, "uk", "de");
    expect(selected).toHaveLength(1);
    expect(selected[0]?.credit.target.id).toBe("hero");
  });

  it("orders the projection by canonical materialTargetKey", () => {
    const records = [
      makeRecord("zzz", "de"),
      makeRecord("aaa", "de"),
      makeRecord("mid", "de", { target: { kind: "video", id: "mid" } }),
    ];
    const selected = selectCreditsPageRecords(records, "de", "de");
    expect(selected.map((r) => r.credit.target.id)).toEqual(["aaa", "zzz", "mid"]);
  });
});
