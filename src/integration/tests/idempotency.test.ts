/*
<MODULE_CONTRACT>
<purpose>RFC-1112: verify the Upstash Redis REST receipt store. get parses the stored
{ receipt, bodyHash } record or returns null on a miss; put issues SET NX EX with the
receipt JSON and the configured key prefix. Both throw on transport errors so the
caller can decide fail-open semantics. fetch is stubbed — no network.</purpose>
<responsibilities>
  <item>get → null on miss, parsed record on hit, correct key prefix.</item>
  <item>put → SET key JSON NX EX ttl command shape.</item>
  <item>transport errors propagate (throw).</item>
</responsibilities>
<non-goals><item>No network — fetch stubbed.</item></non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY><item>RFC-1112: initial receipt store test.</item></CHANGE_SUMMARY>
*/

import { test, expect } from "vitest";
import { restRedisReceiptStore, type ReceiptStoreRecord } from "../idempotency.ts";
import type { ActionReceipt } from "@warpgogol/werkstatt-shared/agent";

const RECEIPT: ActionReceipt = {
  receiptId: "11111111-1111-1111-1111-111111111111",
  status: "accepted",
  duplicate: false,
  submittedAt: "2026-07-05T00:00:00.000Z",
};

const CONFIG = { url: "https://eu-redis.upstash.io", token: "redis-secret" };

function stubFetch(status: number, result: unknown) {
  return async () => new Response(JSON.stringify({ result }), { status });
}

test("restRedisReceiptStore.get returns null on a miss", async () => {
  const store = restRedisReceiptStore(CONFIG, stubFetch(200, null) as unknown as typeof fetch);
  expect(await store.get("key-1")).toBeNull();
});

test("restRedisReceiptStore.get parses the stored record", async () => {
  const record: ReceiptStoreRecord = { receipt: RECEIPT, bodyHash: "abc123" };
  const store = restRedisReceiptStore(
    CONFIG,
    stubFetch(200, JSON.stringify(record)) as unknown as typeof fetch,
  );
  const got = await store.get("key-1");
  expect(got).toEqual(record);
});

test("restRedisReceiptStore.get uses the configured key prefix", async () => {
  let capturedBody = "";
  const fetchSpy = (async (_url: unknown, init?: { body?: string }) => {
    capturedBody = init?.body ?? "";
    return new Response(JSON.stringify({ result: null }), { status: 200 });
  }) as unknown as typeof fetch;
  const store = restRedisReceiptStore({ ...CONFIG, prefix: "custom-prefix" }, fetchSpy);
  await store.get("key-9");
  expect(capturedBody).toBe(JSON.stringify(["GET", "custom-prefix:key-9"]));
});

test("restRedisReceiptStore.put issues SET key JSON NX EX ttl", async () => {
  let capturedBody = "";
  const fetchSpy = (async (_url: unknown, init?: { body?: string }) => {
    capturedBody = init?.body ?? "";
    return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
  }) as unknown as typeof fetch;
  const store = restRedisReceiptStore(CONFIG, fetchSpy);
  await store.put("key-1", "hash-1", RECEIPT, 86400);
  const command = JSON.parse(capturedBody) as string[];
  expect(command[0]).toBe("SET");
  expect(command[1]).toBe("gogol-agent-idem:key-1");
  const record = JSON.parse(command[2]!) as ReceiptStoreRecord;
  expect(record.bodyHash).toBe("hash-1");
  expect(record.receipt.receiptId).toBe(RECEIPT.receiptId);
  expect(command.slice(3)).toEqual(["NX", "EX", "86400"]);
});

test("restRedisReceiptStore throws on transport errors", async () => {
  const store = restRedisReceiptStore(CONFIG, stubFetch(500, null) as unknown as typeof fetch);
  await expect(() => store.get("key-1")).rejects.toThrow();
  await expect(() => store.put("key-1", "h", RECEIPT, 60)).rejects.toThrow();
});
