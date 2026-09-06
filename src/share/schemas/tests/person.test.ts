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
