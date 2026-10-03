/*
<MODULE_CONTRACT>
<purpose>
RFC-1187: durable agent registration store, backed by the same Upstash Redis
EU REST endpoint as the RFC-1112 receipt store. Persists registration records
(agentId → registration JSON), single-use registration challenges (GETDEL
consumption), and a SET index for operator listing. Stores credential secret
HASHES only — never plaintext secrets, never lead payload fields.
</purpose>
<non-goals>
  <item>Do not log or embed secrets — the caller injects RestRedisConfig.</item>
  <item>Do not implement the port contract here — the shape satisfies
        AgentRegistrationRegistry from agent/registration.ts structurally.</item>
  <item>Do not cache — every call is a REST roundtrip; the gate's per-request
        volume is small enough for v1.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1187: initial agent registration store + Upstash Redis REST adapter.</item>
  <item>RFC-1187: phases 1-3 — contracts, Redis registry, AS core + Bearer pipeline</item>
</CHANGE_SUMMARY>
*/

import type { AgentRegistration, AgentRegistrationRegistry } from "../agent/registration.ts";
import type { RestRedisConfig } from "./qstash.ts";

const REG_KEY_PREFIX = "reg";
const CHALLENGE_KEY_PREFIX = "challenge";
const INDEX_KEY = "reg-index";

/**
 * Adapt an Upstash Redis REST endpoint to the AgentRegistrationRegistry
 * (RFC-1187). Registration records are plain GET/SET JSON; challenges are
 * `SET … EX` + `GETDEL` (atomic single-use); the index is a SMEMBERS set
 * maintained alongside `put`. Throws on transport errors so the caller can
 * decide fail-open semantics.
 */
export function restRedisAgentRegistry(
  config: RestRedisConfig,
  fetchImpl: typeof fetch = fetch,
): AgentRegistrationRegistry {
  const prefix = config.prefix ?? "gogol-agent-auth";
  const headers = {
    authorization: `Bearer ${config.token}`,
    "content-type": "application/json",
  };

  async function run(commands: string[][]): Promise<unknown[]> {
    // Upstash REST accepts a pipeline array — one roundtrip for related ops.
    const response = await fetchImpl(`${config.url}/pipeline`, {
      method: "POST",
      headers,
      body: JSON.stringify(commands),
    });
    if (!response.ok) {
      throw new Error(`redis agent-registry pipeline failed: ${response.status}`);
    }
    const data = (await response.json()) as Array<{ result?: unknown; error?: string }>;
    for (const entry of data) {
      if (entry.error) throw new Error(`redis agent-registry command failed: ${entry.error}`);
    }
    return data.map((entry) => entry.result ?? null);
  }

  return {
    async get(agentId: string): Promise<AgentRegistration | null> {
      const [result] = await run([["GET", `${prefix}:${REG_KEY_PREFIX}:${agentId}`]]);
      return typeof result === "string" ? (JSON.parse(result) as AgentRegistration) : null;
    },

    async put(registration: AgentRegistration): Promise<void> {
      await run([
        [
          "SET",
          `${prefix}:${REG_KEY_PREFIX}:${registration.agentId}`,
          JSON.stringify(registration),
        ],
        ["SADD", `${prefix}:${INDEX_KEY}`, registration.agentId],
      ]);
    },

    async putChallenge(nonce: string, ttlSeconds: number): Promise<void> {
      await run([
        ["SET", `${prefix}:${CHALLENGE_KEY_PREFIX}:${nonce}`, "1", "EX", String(ttlSeconds)],
      ]);
    },

    async consumeChallenge(nonce: string): Promise<boolean> {
      // GETDEL — atomic single-use read; a replay finds nothing.
      const [result] = await run([["GETDEL", `${prefix}:${CHALLENGE_KEY_PREFIX}:${nonce}`]]);
      return typeof result === "string";
    },

    async list(): Promise<AgentRegistration[]> {
      const [members] = await run([["SMEMBERS", `${prefix}:${INDEX_KEY}`]]);
      if (!Array.isArray(members)) return [];
      const ids = members.filter((m): m is string => typeof m === "string");
      if (ids.length === 0) return [];
      const values = await run(ids.map((id) => ["GET", `${prefix}:${REG_KEY_PREFIX}:${id}`]));
      return values
        .filter((v): v is string => typeof v === "string")
        .map((v) => JSON.parse(v) as AgentRegistration);
    },
  };
}
