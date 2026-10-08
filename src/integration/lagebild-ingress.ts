/*
<MODULE_CONTRACT>
<purpose>Thin HTTP client for Lagebild API POST /v1/ingress. Werkstatt does NOT
recreate Lagebild semantics locally — it only calls the public WebsiteIngress v1
contract. The client builds the payload from form data, sends it with a service
principal API key, and returns the acceptance result. Replay protection is
built-in via a stable idempotency_key (derived from submission_id + tenant).</purpose>
<non-goals>
  <item>Do not implement Lagebild domain logic — only the HTTP call.</item>
  <item>Do not persist anything locally — the API owns canonical state.</item>
  <item>Do not retry on non-2xx — the caller decides retry strategy.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1198: cookie-free referral attribution — /r/<slug> partner landings + voluntary referrer field

Replace the RFC-1191 wg_ref cookie capture with URL+form attribution:
static /r/<slug> and /<lang>/r/<slug> partner landings (noindex, zero JS,
consent-gated via publicNameConsentRef), ?ref prefill on the existing
referrerField rail, server-side slug resolution against the bundled
partners.yaml, referral_partner_slug/name on the Lagebild ingress contract,
legacy /?ref -> /r/<slug> 302 in the generated worker, and full removal of
the cookie capture module (wg_ref, referral.attribution entitlement,
payload.attribution).</item>
  <item>RFC-1222: additive receipt-provenance fields on the referral block —
partner_mode, policy_effective_from, captured_at, disclosure_version.</item>
  <item>RFC-1239: additive process_hint pass-through — Verbund Seam C (V04,
H02). IngressProcessHint mirrors the vendored process-hint/v1 schema
byte-for-byte until AMD-WERKSTATT-02 ships a website-ingress schema
(PLAN-RFC-1238-01). The client serializes the input verbatim; detection and
mapping live in lagebild-destination-adapter.ts.</item>
  <item>PLAN-RFC-1238-01 (delivered): hand-written contract types retired —
all wire types now derive from the vendored verbund-integration-spec-v0.1.3
schemas via lagebild-contracts.types.generated.ts (AMD-WERKSTATT-02 shipped
website-ingress.schema.yaml in v0.1.2). This file re-exports them for
compat; only client-side types (IngressSubmitInput, IngressResult,
LagebildIngressConfig) remain hand-written — they are not contract surfaces.
Wire behaviour unchanged.</item>
  <item>RFC-1241: Verbund V05 — emit acquisition-context on website-ingress (first-touch UTM)

RFC-1241: sessionStorage-captured first-touch utm_* flows
browser -> send-message -> IntegrationEvent.payload.acquisition ->
lagebild destination adapter -> website-ingress/v1 acquisition field.
Producer validates the contract shape at every edge; malformed degrades
to absent, never a dispatch error. contract_version stays 1.

- shared: acquisition.ts (capture/read/isValid, storage-injected)
- ingress: IngressSubmitInput.acquisition -> wire field
- adapter: validated pass-through of payload.acquisition
- site: SendMessageRequestSchema.acquisition + client attach +
  api re-validation + site-wide capture mount in layout-component
- codegen repin v0.1.3 -> v0.1.4 (VID-016 republication); generated
  types unchanged in shape, new sourceHash
- conformance: emitted acquisition + emitted ingress surface validated
  per snapshot (82 tests, 5 snapshots)</item>
  <history>RFC-1097</history>
</CHANGE_SUMMARY>
*/

import type {
  AcquisitionContext,
  ExplicitPolicyAssertion,
  IdentityClaim,
  IngressInteractionKind,
  IngressOrigin,
  IngressProcessHint,
  WebsiteIngressPayload,
} from "./lagebild-contracts.types.generated.ts";

export {
  type AcquisitionContext,
  type ExplicitPolicyAssertion,
  type IdentityClaim,
  type IdentityClaimType,
  type IngressInteractionKind,
  type IngressOrigin,
  type IngressProcessHint,
  type IngressProcessHintSystem,
  type PolicyAssertionKind,
  type WebsiteIngressPayload,
} from "./lagebild-contracts.types.generated.ts";

export const LAGEBILD_INGRESS_CONTRACT_VERSION = 1 as const;

export interface IngressResult {
  readonly submission_id: string | null;
  readonly accepted: boolean;
  readonly is_replay: boolean;
  readonly rejection_class?: string | null;
  readonly correlation_id?: string | null;
}

export interface LagebildIngressConfig {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly tenantId: string;
  readonly sourceSystemId: string;
}

export interface IngressSubmitInput {
  readonly submissionId: string;
  readonly idempotencyKey: string;
  readonly interactionKind: IngressInteractionKind;
  readonly identityClaims: readonly IdentityClaim[];
  readonly message?: string | null;
  readonly origin?: IngressOrigin;
  readonly explicitPolicyAssertions?: readonly ExplicitPolicyAssertion[];
  readonly correlationId?: string | null;
  readonly referralPartnerSlug?: string | null;
  readonly referralPartnerName?: string | null;
  readonly partnerMode?: string | null;
  readonly policyEffectiveFrom?: string | null;
  readonly capturedAt?: string | null;
  readonly disclosureVersion?: string | null;
  /** RFC-1239: already wire-shaped (snake_case) — serialized verbatim. */
  readonly processHint?: IngressProcessHint;
  /** RFC-1241: already wire-shaped (snake_case) — serialized verbatim. */
  readonly acquisition?: AcquisitionContext;
}

/**
 * Submit a website ingress event to the Lagebild API.
 * Returns the acceptance result. Does not throw on non-2xx — returns
 * a result with accepted=false so the caller can decide retry strategy.
 */
export async function submitIngress(
  config: LagebildIngressConfig,
  input: IngressSubmitInput,
): Promise<IngressResult> {
  const payload: WebsiteIngressPayload = {
    contract_version: LAGEBILD_INGRESS_CONTRACT_VERSION,
    tenant_id: config.tenantId,
    source_system_id: config.sourceSystemId,
    submission_id: input.submissionId,
    idempotency_key: input.idempotencyKey,
    occurred_at: new Date().toISOString(),
    interaction_kind: input.interactionKind,
    identity_claims: input.identityClaims,
    ...(input.message != null ? { message: input.message } : {}),
    ...(input.origin != null ? { origin: input.origin } : {}),
    ...(input.explicitPolicyAssertions != null
      ? { explicit_policy_assertions: input.explicitPolicyAssertions }
      : {}),
    ...(input.correlationId != null ? { correlation_id: input.correlationId } : {}),
    ...(input.referralPartnerSlug != null
      ? { referral_partner_slug: input.referralPartnerSlug }
      : {}),
    ...(input.referralPartnerName != null
      ? { referral_partner_name: input.referralPartnerName }
      : {}),
    ...(input.partnerMode != null ? { partner_mode: input.partnerMode } : {}),
    ...(input.policyEffectiveFrom != null
      ? { policy_effective_from: input.policyEffectiveFrom }
      : {}),
    ...(input.capturedAt != null ? { captured_at: input.capturedAt } : {}),
    ...(input.disclosureVersion != null ? { disclosure_version: input.disclosureVersion } : {}),
    ...(input.processHint != null ? { process_hint: input.processHint } : {}),
    ...(input.acquisition != null ? { acquisition: input.acquisition } : {}),
  };

  const url = config.apiUrl.replace(/\/$/, "") + "/v1/ingress";

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.apiKey,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      submission_id: input.submissionId,
      accepted: false,
      is_replay: false,
      rejection_class: "network_error",
      correlation_id: input.correlationId ?? null,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  const result = body as Partial<IngressResult>;
  return {
    submission_id: result.submission_id ?? input.submissionId,
    accepted: result.accepted ?? response.ok,
    is_replay: result.is_replay ?? false,
    rejection_class: result.rejection_class ?? null,
    correlation_id: result.correlation_id ?? input.correlationId ?? null,
  };
}

/**
 * Build a stable idempotency key from tenant + submission ID.
 * This ensures retries within the same submission are deduplicated
 * by the Lagebild API.
 */
export function buildIdempotencyKey(tenantId: string, submissionId: string): string {
  return tenantId + ":" + submissionId;
}
