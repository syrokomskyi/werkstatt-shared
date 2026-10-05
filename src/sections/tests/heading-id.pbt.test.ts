/*
<MODULE_CONTRACT>
<purpose>RFC-1196: property guarantees for sectionHeadingId() (DNA-101 PBT) —
a falsy prefix never produces a leading-dash id, non-empty sectionNumber always
wins, and empty prefix sources are equivalent to absent ones.</purpose>
<non-goals>
  <item>Do not validate caller-supplied id shape — the kebab typeId contract belongs to the section schema.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1196: created — fast-check properties over all prefix-source combinations.</item>
  <item>RFC-1196: review — sectionId from rawProps only, Compass headers on new tests</item>
</CHANGE_SUMMARY>
*/

import { test, expect } from "vitest";
import fc from "fast-check";
import { sectionHeadingId } from "../heading-id.ts";

/**
 * RFC-1196 — property guarantees for the shared heading-id resolver.
 * Pure function: no DOM, no IO.
 */

const arbTypeId = fc.option(fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,59}$/), { nil: undefined });
const arbMaybeEmpty = fc.option(fc.string({ maxLength: 40 }), { nil: undefined });

test("result never starts with '-' — an empty prefix must never leak into the id", () => {
  fc.assert(
    fc.property(arbTypeId, arbMaybeEmpty, arbMaybeEmpty, (typeId, num, sid) => {
      const id = sectionHeadingId(typeId, num, sid);
      if (id !== undefined) {
        expect(id.startsWith("-"), `id "${id}" must not start with '-'`).toBe(false);
      }
    }),
  );
});

test("falsy prefix sources return the type id unchanged", () => {
  fc.assert(
    fc.property(arbTypeId, (typeId) => {
      expect(sectionHeadingId(typeId, undefined, undefined)).toBe(typeId);
      expect(sectionHeadingId(typeId, "", "")).toBe(typeId);
      expect(sectionHeadingId(typeId, "", undefined)).toBe(typeId);
      expect(sectionHeadingId(typeId, undefined, "")).toBe(typeId);
    }),
  );
});

test("non-empty sectionNumber always wins over sectionId", () => {
  fc.assert(
    fc.property(
      arbTypeId,
      fc.string({ minLength: 1, maxLength: 40 }),
      arbMaybeEmpty,
      (typeId, num, sid) => {
        const id = sectionHeadingId(typeId, num, sid);
        if (typeId !== undefined) {
          expect(id, `non-empty sectionNumber "${num}" must prefix the type id`).toBe(
            `${num}-${typeId}`,
          );
        }
      },
    ),
  );
});

test("empty sectionNumber behaves identically to absent sectionNumber", () => {
  fc.assert(
    fc.property(arbTypeId, arbMaybeEmpty, (typeId, sid) => {
      expect(sectionHeadingId(typeId, "", sid)).toBe(sectionHeadingId(typeId, undefined, sid));
    }),
  );
});
