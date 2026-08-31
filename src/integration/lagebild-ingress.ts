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
*/

export const LAGEBILD_INGRESS_CONTRACT_VERSION = 1 as const;

export type IngressInteractionKind =
  | "inquiry"
  | "contact_message"
  | "callback_request"
  | "appointment_request"
  | "other";

export type IdentityClaimType =
  | "person_name"
  | "organization_name"
  | "email"
  | "phone"
  | "website"
  | "postal_address"
  | "other";

export interface IdentityClaim {
  readonly claim_type: IdentityClaimType;
  readonly value: string;
  readonly label?: string | null;
}

export interface IngressOrigin {
  readonly page_uri?: string | null;
  readonly referrer_uri?: string | null;
  readonly locale?: string | null;
}

export type PolicyAssertionKind = "consent" | "objection" | "preference";

export interface ExplicitPolicyAssertion {
  readonly kind: PolicyAssertionKind;
  readonly purpose: string;
  readonly channel?: string | null;
  readonly value: boolean;
  readonly statement_ref?: string | null;
}

export interface WebsiteIngressPayload {
  readonly contract_version: typeof LAGEBILD_INGRESS_CONTRACT_VERSION;
  readonly tenant_id: string;
  readonly source_system_id: string;
  readonly submission_id: string;
  readonly idempotency_key: string;
  readonly occurred_at: string;
  readonly interaction_kind: IngressInteractionKind;
  readonly identity_claims: readonly IdentityClaim[];
  readonly message?: string | null;
  readonly origin?: IngressOrigin;
  readonly explicit_policy_assertions?: readonly ExplicitPolicyAssertion[];
  readonly correlation_id?: string | null;
}

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
