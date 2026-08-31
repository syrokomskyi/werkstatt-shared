/*
<MODULE_CONTRACT>
<purpose>Unit tests for the Lagebild ingress HTTP client. Verifies payload
construction, idempotency key generation, and network error handling.</purpose>
<non-goals>
  <item>Do not make real HTTP calls — fetch is mocked.</item>
</non-goals>
</MODULE_CONTRACT>
*/

import { test, expect, vi } from "vitest";
import {
  submitIngress,
  buildIdempotencyKey,
  LAGEBILD_INGRESS_CONTRACT_VERSION,
  type LagebildIngressConfig,
} from "../lagebild-ingress.ts";

const baseConfig: LagebildIngressConfig = {
  apiUrl: "https://lagebild-api.example.workers.dev",
  apiKey: "lbk_test_key_0001",
  tenantId: "ten_warpgogol000001",
  sourceSystemId: "site_warpgogol_com",
};

test("buildIdempotencyKey is stable and combines tenant + submission", () => {
  const key = buildIdempotencyKey("ten_abc", "sub_123");
  expect(key).toBe("ten_abc:sub_123");
  expect(buildIdempotencyKey("ten_abc", "sub_123")).toBe(key);
});

test("submitIngress sends POST with correct headers and payload", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        submission_id: "sub_test00000000000001",
        accepted: true,
        is_replay: false,
        correlation_id: null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );

  const result = await submitIngress(baseConfig, {
    submissionId: "sub_test00000000000001",
    idempotencyKey: "ten_warpgogol000001:sub_test00000000000001",
    interactionKind: "contact_message",
    identityClaims: [
      { claim_type: "email", value: "test@example.com" },
      { claim_type: "person_name", value: "Test User" },
    ],
    message: "Hello from the test",
    origin: { page_uri: "https://example.com/contact", locale: "de" },
  });

  expect(result.accepted).toBe(true);
  expect(result.is_replay).toBe(false);

  expect(fetchSpy).toHaveBeenCalledOnce();
  const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("https://lagebild-api.example.workers.dev/v1/ingress");
  expect(init.method).toBe("POST");
  expect((init.headers as Record<string, string>)["Authorization"]).toBe(
    "Bearer lbk_test_key_0001",
  );

  const body = JSON.parse(init.body as string) as Record<string, unknown>;
  expect(body["contract_version"]).toBe(LAGEBILD_INGRESS_CONTRACT_VERSION);
  expect(body["tenant_id"]).toBe("ten_warpgogol000001");
  expect(body["source_system_id"]).toBe("site_warpgogol_com");
  expect(body["interaction_kind"]).toBe("contact_message");

  fetchSpy.mockRestore();
});

test("submitIngress returns accepted=false on network error", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("connection refused"));

  const result = await submitIngress(baseConfig, {
    submissionId: "sub_test00000000000002",
    idempotencyKey: "ten:test2",
    interactionKind: "inquiry",
    identityClaims: [{ claim_type: "email", value: "test@example.com" }],
  });

  expect(result.accepted).toBe(false);
  expect(result.rejection_class).toBe("network_error");

  vi.restoreAllMocks();
});

test("submitIngress returns accepted=false on 400 response", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        submission_id: "sub_test00000000000003",
        accepted: false,
        is_replay: false,
        rejection_class: "schema_invalid",
        correlation_id: null,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    ),
  );

  const result = await submitIngress(baseConfig, {
    submissionId: "sub_test00000000000003",
    idempotencyKey: "ten:test3",
    interactionKind: "inquiry",
    identityClaims: [{ claim_type: "email", value: "bad" }],
  });

  expect(result.accepted).toBe(false);
  expect(result.rejection_class).toBe("schema_invalid");

  vi.restoreAllMocks();
});
