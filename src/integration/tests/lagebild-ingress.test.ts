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
import {
  lagebildDestinationAdapter,
  funnelPayloadToProcessHint,
} from "../lagebild-destination-adapter.ts";
import type { IntegrationEvent } from "../port.ts";

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

test("submitIngress serializes processHint verbatim as process_hint (RFC-1239)", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify({ accepted: true, is_replay: false }), { status: 201 }),
    );

  await submitIngress(baseConfig, {
    submissionId: "sub_hint0000000000001",
    idempotencyKey: "ten:hint1",
    interactionKind: "other",
    identityClaims: [{ claim_type: "email", value: "t@example.com" }],
    processHint: {
      schema: "process-hint/v1",
      system: "werkstatt",
      catalog_ref: "werkstatt:visitor-funnel/v1",
      phase: "offer_presented",
      previous_phase: "qualification_region",
      changed_at: "2026-10-08T10:00:00.000Z",
      reason: "qualification.answered",
    },
  });

  const body = JSON.parse(
    (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
  ) as Record<string, unknown>;
  expect(body["process_hint"]).toEqual({
    schema: "process-hint/v1",
    system: "werkstatt",
    catalog_ref: "werkstatt:visitor-funnel/v1",
    phase: "offer_presented",
    previous_phase: "qualification_region",
    changed_at: "2026-10-08T10:00:00.000Z",
    reason: "qualification.answered",
  });
  expect(body["contract_version"]).toBe(1);

  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// RFC-1239 / spec v0.1.1 V04 (handoffs.yaml H02): funnel transitions →
// process_hint on the wire, built by the destination adapter.
// ---------------------------------------------------------------------------

const secrets = {
  LAGEBILD_API_URL: "https://lagebild-api.example.workers.dev",
  LAGEBILD_API_KEY: "lbk_test_key_0001",
  LAGEBILD_TENANT_ID: "ten_warpgogol000001",
  LAGEBILD_SOURCE_SYSTEM_ID: "site_warpgogol_com",
};

function funnelEvent(payload: Record<string, unknown>): IntegrationEvent {
  return {
    eventId: "evt-funnel-0000000000000001",
    kind: "message",
    source: "uchat",
    locale: "de",
    occurredAt: "2026-10-08T10:00:00.000Z",
    payload,
  };
}

async function captureIngressBody(event: IntegrationEvent): Promise<Record<string, unknown>> {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        submission_id: "sub_evt00000000000000001",
        accepted: true,
        is_replay: false,
      }),
      { status: 201 },
    ),
  );
  await lagebildDestinationAdapter.route(event, secrets);
  const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
  vi.restoreAllMocks();
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

test("funnel transition emits process_hint with reason=eventKind (AC-1, AC-5)", async () => {
  const body = await captureIngressBody(
    funnelEvent({
      funnelVersion: "1.0.0",
      eventKind: "qualification.answered",
      stage: "qualification_company",
      previousStage: "qualification_priority",
      contact: { email: "visitor@example.com" },
    }),
  );

  expect(body["process_hint"]).toEqual({
    schema: "process-hint/v1",
    system: "werkstatt",
    catalog_ref: "werkstatt:visitor-funnel/v1",
    phase: "qualification_company",
    previous_phase: "qualification_priority",
    changed_at: "2026-10-08T10:00:00.000Z",
    reason: "qualification.answered",
  });
  // Fallback: claims came from payload.contact, not event.contact.
  expect(body["identity_claims"]).toEqual([{ claim_type: "email", value: "visitor@example.com" }]);
  // Funnel-only submission (no message) — honest kind, not contact_message.
  expect(body["interaction_kind"]).toBe("other");
});

test("first observed stage emits hint without previous_phase", async () => {
  const body = await captureIngressBody(
    funnelEvent({
      funnelVersion: "1.0.0",
      eventKind: "privacy.acknowledged",
      stage: "privacy_acknowledged",
      contact: { email: "v@example.com" },
    }),
  );

  const hint = body["process_hint"] as Record<string, unknown>;
  expect(hint["phase"]).toBe("privacy_acknowledged");
  expect("previous_phase" in hint).toBe(false);
});

test("no hint when stage equals previousStage, stage absent, or event is not a funnel payload (AC-3)", async () => {
  const noTransition = await captureIngressBody(
    funnelEvent({
      funnelVersion: "1.0.0",
      eventKind: "operator.note.added",
      stage: "operator_review",
      previousStage: "operator_review",
    }),
  );
  expect("process_hint" in noTransition).toBe(false);

  const noStage = await captureIngressBody(
    funnelEvent({ funnelVersion: "1.0.0", eventKind: "language.selected" }),
  );
  expect("process_hint" in noStage).toBe(false);

  const plainLead = await captureIngressBody({
    eventId: "evt-lead-00000000000000001",
    kind: "lead",
    source: "send-message",
    locale: "de",
    occurredAt: "2026-10-08T10:00:00.000Z",
    contact: { email: "lead@example.com" },
    payload: { message: "plain contact form" },
  });
  expect("process_hint" in plainLead).toBe(false);
  expect(plainLead["interaction_kind"]).toBe("contact_message");
});

// ---------------------------------------------------------------------------
// RFC-1241 / spec v0.1.4 V05: acquisition-context on the wire — adapter
// pass-through with structural validation; malformed degrades to absent.
// ---------------------------------------------------------------------------

test("adapter passes a valid payload.acquisition through as the acquisition wire field (RFC-1241, AC-3)", async () => {
  const body = await captureIngressBody(
    funnelEvent({
      funnelVersion: "1.0.0",
      eventKind: "material.submitted",
      stage: "materials_requested",
      contact: { email: "v@example.com" },
      acquisition: {
        schema: "acquisition-context/v1",
        utm_source: "meta",
        utm_medium: "paid_social",
        utm_campaign: "sit001-bw-v1",
        utm_term: "-",
        utm_content: "cre_b3d8e2f1",
        utm_id: "exp_7f2a91c4",
      },
    }),
  );
  expect(body["acquisition"]).toEqual({
    schema: "acquisition-context/v1",
    utm_source: "meta",
    utm_medium: "paid_social",
    utm_campaign: "sit001-bw-v1",
    utm_term: "-",
    utm_content: "cre_b3d8e2f1",
    utm_id: "exp_7f2a91c4",
  });
});

test("adapter omits malformed payload.acquisition without throwing (RFC-1241, AC-3)", async () => {
  const missingKey = await captureIngressBody(
    funnelEvent({
      contact: { email: "v@example.com" },
      acquisition: { schema: "acquisition-context/v1", utm_source: "meta" },
    }),
  );
  expect("acquisition" in missingKey).toBe(false);

  const extraKey = await captureIngressBody(
    funnelEvent({
      contact: { email: "v@example.com" },
      acquisition: {
        schema: "acquisition-context/v1",
        utm_source: "meta",
        utm_medium: "cpc",
        utm_campaign: "c",
        utm_term: "-",
        utm_content: "-",
        utm_id: "-",
        fbclid: "IwAR123", // platform click ids are inexpressible by contract
      },
    }),
  );
  expect("acquisition" in extraKey).toBe(false);

  const badCharset = await captureIngressBody(
    funnelEvent({
      contact: { email: "v@example.com" },
      acquisition: {
        schema: "acquisition-context/v1",
        utm_source: "meta ads", // space violates the contract charset
        utm_medium: "cpc",
        utm_campaign: "c",
        utm_term: "-",
        utm_content: "-",
        utm_id: "-",
      },
    }),
  );
  expect("acquisition" in badCharset).toBe(false);
});

test("submitIngress serializes input.acquisition verbatim as acquisition (RFC-1241, AC-3)", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify({ accepted: true, is_replay: false }), { status: 201 }),
    );

  await submitIngress(baseConfig, {
    submissionId: "sub_acq00000000000001",
    idempotencyKey: "ten:acq1",
    interactionKind: "contact_message",
    identityClaims: [{ claim_type: "email", value: "t@example.com" }],
    acquisition: {
      schema: "acquisition-context/v1",
      utm_source: "newsletter",
      utm_medium: "email",
      utm_campaign: "launch-2026",
      utm_term: "-",
      utm_content: "-",
      utm_id: "-",
    },
  });

  const body = JSON.parse(
    (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
  ) as Record<string, unknown>;
  expect(body["acquisition"]).toEqual({
    schema: "acquisition-context/v1",
    utm_source: "newsletter",
    utm_medium: "email",
    utm_campaign: "launch-2026",
    utm_term: "-",
    utm_content: "-",
    utm_id: "-",
  });
  expect(body["contract_version"]).toBe(1);

  vi.restoreAllMocks();
});

test("system is the literal werkstatt — personal_agent can never be emitted (AC-3)", () => {
  const hint = funnelPayloadToProcessHint(
    {
      funnelVersion: "1.0.0",
      eventKind: "operator.won",
      stage: "won",
      previousStage: "operator_review",
    },
    "2026-10-08T11:00:00.000Z",
  );
  expect(hint?.system).toBe("werkstatt");
  expect(hint?.phase).toBe("won");
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
