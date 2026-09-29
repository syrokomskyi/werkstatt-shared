import { describe, expect, test } from "vitest";

import { agentTrafficEventSchema, type AgentTrafficEvent } from "./telemetry.ts";

function canonicalEvent(): AgentTrafficEvent {
  return {
    type: "werkstatt.agent.traffic",
    timestamp: "2026-10-01T10:15:30.000Z",
    systemId: "warpgogol",
    protocol: "mcp",
    operation: "tools/call",
    capability: "lead.prepare",
    status: "success",
    mcpProtocolVersion: "2026-07-28",
    durationMs: 14,
  };
}

describe("agentTrafficEventSchema (RFC-1172)", () => {
  test("accepts a canonical event", () => {
    const parsed = agentTrafficEventSchema.parse(canonicalEvent());
    expect(parsed.type).toBe("werkstatt.agent.traffic");
    expect(parsed.operation).toBe("tools/call");
  });

  test("AC-2: rejects events with fields outside the closed schema", () => {
    const creep = { ...canonicalEvent(), requestBody: "leak me" };
    expect(() => agentTrafficEventSchema.parse(creep)).toThrow();
    const summaryCreep = { ...canonicalEvent(), summary: "payload creep" };
    expect(() => agentTrafficEventSchema.parse(summaryCreep)).toThrow();
  });

  test("rejects unknown enum values (DNA-19)", () => {
    expect(() =>
      agentTrafficEventSchema.parse({ ...canonicalEvent(), protocol: "grpc" }),
    ).toThrow();
    expect(() =>
      agentTrafficEventSchema.parse({ ...canonicalEvent(), operation: "actions/{id}" }),
    ).toThrow();
    expect(() => agentTrafficEventSchema.parse({ ...canonicalEvent(), status: "ok" })).toThrow();
  });

  test("rejects negative durationMs", () => {
    expect(() => agentTrafficEventSchema.parse({ ...canonicalEvent(), durationMs: -1 })).toThrow();
  });
});
