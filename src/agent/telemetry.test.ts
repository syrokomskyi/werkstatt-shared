/*
<MODULE_CONTRACT>
<purpose>
RFC-1172: closed-schema coverage for agentTrafficEventSchema — canonical
acceptance, unknown-field rejection (AC-2 payload creep), unknown enum
rejection (DNA-19), and durationMs bounds.
</purpose>
<non-goals>
  <item>Do not test emission — the boundary emit + recorder live in werkstatt-engine.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1172: initial schema test.</item>
  <item>RFC-1172: fo-review — extractAgentIdentity on all routes, honest mcpProtocolVersion, top-level import, test header</item>
</CHANGE_SUMMARY>
*/

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
