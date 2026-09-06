import { describe, it, expect } from "vitest";
import { FLEET_AGENT_CATALOG_SCHEMA, buildFleetAgentCatalog } from "../fleet-catalog.ts";

describe("FLEET_AGENT_CATALOG_SCHEMA", () => {
  it("is a string constant", () => {
    expect(typeof FLEET_AGENT_CATALOG_SCHEMA).toBe("string");
    expect(FLEET_AGENT_CATALOG_SCHEMA).toContain("fleet.agent-catalog");
  });
});

describe("buildFleetAgentCatalog", () => {
  it("is a function", () => {
    expect(typeof buildFleetAgentCatalog).toBe("function");
  });
});
