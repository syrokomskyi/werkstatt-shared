/*
<MODULE_CONTRACT>
<purpose>
RFC-1112: durable receipt store for agent-action idempotency, backed by the
same Upstash Redis EU REST endpoint as the RFC-0181 delivery ledger. Maps an
Idempotency-Key to { receipt, bodyHash } so a replayed request returns the
original receipt without re-dispatching, and a key reused with a different
payload is rejected. Stores identifiers only — never lead payload fields.
</purpose>
<non-goals>
  <item>Do not log or embed secrets — the caller injects RestRedisConfig.</item>
  <item>Do not implement the port contract here — the engine's IdempotencyPort
        is structurally identical; this adapter satisfies it.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1112: initial receipt store + Upstash Redis REST adapter.</item>
</CHANGE_SUMMARY>
*/

import type { ActionReceipt } from "@warpgogol/werkstatt-shared/agent";
import type { RestRedisConfig } from "./qstash.ts";

/** Stored record: the original receipt plus the request-body hash it was issued for. */
export interface ReceiptStoreRecord {
  receipt: ActionReceipt;
  /** sha256 of the raw request body (HTTP) or canonicalJsonHashV1 of arguments (MCP). */
  bodyHash: string;
}

/**
 * Receipt store contract (RFC-1112). Structurally identical to the engine's
 * IdempotencyPort — kept here so the adapter type-checks without importing
 * engine code (werkstatt-shared is a leaf package).
 */
export interface ActionReceiptStore {
  get(key: string): Promise<ReceiptStoreRecord | null>;
  put(key: string, bodyHash: string, receipt: ActionReceipt, ttlSeconds: number): Promise<void>;
}

/**
 * Adapt an Upstash Redis REST endpoint to the ActionReceiptStore (RFC-1112).
 * `get` is a plain GET; `put` is `SET key JSON NX EX ttl` — NX keeps the first
 * stored receipt when two same-key requests race. Throws on transport errors
 * so the caller can decide fail-open semantics.
 */
export function restRedisReceiptStore(
  config: RestRedisConfig,
  fetchImpl: typeof fetch = fetch,
): ActionReceiptStore {
  const prefix = config.prefix ?? "gogol-agent-idem";
  const headers = {
    authorization: `Bearer ${config.token}`,
    "content-type": "application/json",
  };
  return {
    async get(key: string): Promise<ReceiptStoreRecord | null> {
      const response = await fetchImpl(config.url, {
        method: "POST",
        headers,
        body: JSON.stringify(["GET", `${prefix}:${key}`]),
      });
      if (!response.ok) {
        throw new Error(`redis receipt GET failed: ${response.status}`);
      }
      const data = (await response.json()) as { result?: string | null };
      if (typeof data.result !== "string") return null;
      return JSON.parse(data.result) as ReceiptStoreRecord;
    },
    async put(
      key: string,
      bodyHash: string,
      receipt: ActionReceipt,
      ttlSeconds: number,
    ): Promise<void> {
      const record: ReceiptStoreRecord = { receipt, bodyHash };
      const command = [
        "SET",
        `${prefix}:${key}`,
        JSON.stringify(record),
        "NX",
        "EX",
        String(ttlSeconds),
      ];
      const response = await fetchImpl(config.url, {
        method: "POST",
        headers,
        body: JSON.stringify(command),
      });
      if (!response.ok) {
        throw new Error(`redis receipt SET failed: ${response.status}`);
      }
    },
  };
}
