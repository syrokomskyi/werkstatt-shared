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
