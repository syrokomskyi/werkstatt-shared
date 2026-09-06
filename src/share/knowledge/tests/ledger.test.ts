import { describe, it, expect } from "vitest";
import type { ClaimEvent, ClaimLineage } from "../ledger.ts";

describe("ledger types", () => {
  it("ClaimEvent is a valid type", () => {
    const event: ClaimEvent = {
      id: "evt-1",
      ts: "2026-01-01T00:00:00Z",
      subject: "test",
      provenance: "asserted",
      asOf: "2026-01-01",
      actor: "agent",
      event: "asserted" as ClaimEvent["event"],
    };
    expect(event).toBeDefined();
  });

  it("ClaimLineage is a valid type", () => {
    const event: ClaimEvent = {
      id: "evt-1",
      ts: "2026-01-01T00:00:00Z",
      subject: "test",
      provenance: "asserted",
      asOf: "2026-01-01",
      actor: "agent",
      event: "asserted" as ClaimEvent["event"],
    };
    const lineage: ClaimLineage = {
      subject: "test",
      current: event,
      history: [event],
    };
    expect(lineage).toBeDefined();
  });
});
