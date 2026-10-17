/*
<MODULE_CONTRACT>
<purpose>
Unit tests for project claims.pbt covering projectClaims — property-based (AC-4).
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the project suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { projectClaims } from "../business-projection.ts";

describe("projectClaims — property-based (AC-4)", () => {
  it("is deterministic — same input always produces same output", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            status: fc.constant("published"),
            statement: fc.string(),
            claimClass: fc.string(),
            claimKind: fc.string(),
          }),
        ),
        (claims) => {
          const a = projectClaims(claims, undefined);
          const b = projectClaims(claims, undefined);
          expect(a).toEqual(b);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("only returns claims with status === published", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            status: fc.oneof(
              fc.constant("published"),
              fc.constant("draft"),
              fc.constant("archived"),
            ),
            statement: fc.string(),
            claimClass: fc.string(),
            claimKind: fc.string(),
          }),
        ),
        (claims) => {
          const result = projectClaims(claims, undefined);
          for (const c of result) {
            expect(c.id).toBeTruthy();
          }
          const publishedIds = claims
            .filter((c) => c.status === "published" && c.id)
            .map((c) => c.id);
          expect(result.map((c) => c.id).sort()).toEqual(publishedIds.sort());
        },
      ),
      { numRuns: 50 },
    );
  });

  it("returns empty array for empty or undefined input", () => {
    fc.assert(
      fc.property(fc.oneof(fc.constant(undefined), fc.constant([])), (input) => {
        expect(projectClaims(input, undefined)).toEqual([]);
      }),
    );
  });
});
