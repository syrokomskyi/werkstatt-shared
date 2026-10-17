/*
<MODULE_CONTRACT>
<purpose>
Unit tests for participant covering PARTICIPANT_TYPES; PARTICIPANT_RELATIONSHIPS; PARTICIPANT_STATUSES. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the participant suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import {
  PARTICIPANT_TYPES,
  PARTICIPANT_RELATIONSHIPS,
  PARTICIPANT_STATUSES,
} from "../participant.ts";

describe("PARTICIPANT_TYPES", () => {
  it("contains expected types", () => {
    expect(PARTICIPANT_TYPES).toContain("human");
    expect(PARTICIPANT_TYPES).toContain("ai-agent");
    expect(PARTICIPANT_TYPES).toHaveLength(6);
  });
});

describe("PARTICIPANT_RELATIONSHIPS", () => {
  it("is a non-empty array", () => {
    expect(PARTICIPANT_RELATIONSHIPS.length).toBeGreaterThan(0);
  });
});

describe("PARTICIPANT_STATUSES", () => {
  it("is a non-empty array", () => {
    expect(PARTICIPANT_STATUSES.length).toBeGreaterThan(0);
  });
});
