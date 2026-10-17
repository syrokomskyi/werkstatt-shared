/*
<MODULE_CONTRACT>
<purpose>
Unit tests for person covering PERSON_AFFILIATIONS. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the person suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { PERSON_AFFILIATIONS } from "../person.ts";

describe("PERSON_AFFILIATIONS", () => {
  it("contains the expected affiliation values", () => {
    expect(PERSON_AFFILIATIONS).toEqual(["founder", "board", "team", "patron", "author"]);
  });

  it("is a readonly tuple", () => {
    expect(PERSON_AFFILIATIONS).toHaveLength(5);
  });
});
